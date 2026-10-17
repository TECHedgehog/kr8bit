import { logger } from '../../logger/index.js';
import { decodeHtmlEntities } from '../../shared/html-entities.js';
import { normalizeGameName, stripEditionPhrase } from '../../shared/normalize.js';
import { MatchStatus } from '../../shared/enums.js';
import { decideMatch, type MatchDecision } from '../../shared/match-policy.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import type { ProviderRegistry } from '../metadata/provider-registry.js';
import type { settingsRepository } from '../settings/settings.repository.js';
import { validateSettingEntries } from '../settings/settings.service.js';
import type { GameMetadata, MetadataProvider, SearchResult } from '../../shared/types.js';
import type { repackCatalogRepository } from './repack-catalog.repository.js';
import { regroupRepackGames } from './repack-catalog.regroup.js';
import {
  REPACK_AUDIT_ENABLED,
  REPACK_AUDIT_INTERVAL_HOURS,
  REPACK_BASE_URL,
  REPACK_CATALOG_SETTING_SPECS,
  REPACK_CATALOG_USER_SETTING_SPECS,
  REPACK_ENABLED,
  REPACK_FULL_IMPORT_COMPLETE,
  REPACK_INTERVAL_HOURS,
} from './repack-catalog.settings.js';
import { fitGirlGameTitle, normalizeFitGirlGameTitle } from './sources/fitgirl/fitgirl.source.js';
import { SourceBlockedError } from './source-http-client.js';
import type { RepackMatchCandidate, RepackMatchStatus, RepackMetadataSnapshot, RepackSource } from './repack-catalog.types.js';

const SCRAPE_CONCURRENCY = 2;

export interface RepackCatalogSettingsUpdate {
  enabled?: boolean;
  baseUrl?: string;
  intervalHours?: number;
  auditEnabled?: boolean;
  auditIntervalHours?: number;
}

export interface RepackCatalogServiceDependencies {
  repackCatalogRepository: typeof repackCatalogRepository;
  settingsRepository: typeof settingsRepository;
  providerRegistry: ProviderRegistry;
  sourceFactory: (baseUrl: string) => RepackSource;
  matchThresholds: { acceptThreshold: number; flagThreshold: number };
}

function settingBool(value: string | null, fallback: boolean): boolean { return value === null ? fallback : value === 'true'; }
function settingNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function specDefault(key: string): string | boolean | number {
  return REPACK_CATALOG_SETTING_SPECS.find((spec) => spec.key === key)?.default ?? '';
}

function candidateFrom(result: SearchResult): RepackMatchCandidate {
  return {
    providerName: result.providerName, remoteId: result.remoteId, title: result.title,
    releaseYear: result.releaseYear, coverUrl: result.coverUrl, score: result.score ?? 0,
  };
}

function repackStatusFromDecision(decision: MatchDecision): RepackMatchStatus {
  switch (decision.status) {
    case MatchStatus.ACCEPTED:
    case MatchStatus.FLAGGED:
    case MatchStatus.MANUAL:
      return 'REVIEW';
    case MatchStatus.REJECTED:
      return 'REJECTED';
    case MatchStatus.PENDING:
      return 'PENDING';
  }
}

function snapshotFrom(metadata: GameMetadata): RepackMetadataSnapshot {
  return {
    remoteId: metadata.remoteId,
    title: metadata.title,
    releaseYear: metadata.releaseYear,
    description: metadata.description,
    developers: metadata.developers,
    publishers: metadata.publishers,
    genres: metadata.genres,
    coverUrl: metadata.coverUrl,
    headerUrl: metadata.headerUrl,
    heroUrl: metadata.heroUrl,
    logoUrl: metadata.logoUrl,
    screenshots: metadata.screenshots,
    videos: metadata.videos,
    steamDeckCompat: metadata.steamDeckCompat ? {
      category: metadata.steamDeckCompat.category,
      items: metadata.steamDeckCompat.items.map((item) => ({ displayType: item.displayType, locToken: item.locToken })),
    } : undefined,
  };
}

async function regroupCatalog(): Promise<void> {
  await regroupRepackGames((title) => ({
    gameTitle: fitGirlGameTitle(title),
    normalizedTitle: normalizeFitGirlGameTitle(title),
  }));
}

async function mapWithLimit<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await work(items[index]);
    }
  });
  await Promise.all(workers);
}

export class RepackCatalogService {
  private running = false;
  private abortController: AbortController | null = null;
  private sourceCache: { baseUrl: string; source: RepackSource } | null = null;
  private status = { phase: 'idle', processed: 0, skipped: 0, failed: 0, total: 0, startedAt: null as string | null };

  constructor(private readonly dependencies: RepackCatalogServiceDependencies) {}

  async enabled(): Promise<boolean> { return settingBool(await this.dependencies.settingsRepository.get(REPACK_ENABLED), false); }

  async settings() {
    const enabledDefault = specDefault(REPACK_ENABLED) as boolean;
    const baseUrlDefault = specDefault(REPACK_BASE_URL) as string;
    const intervalHoursDefault = specDefault(REPACK_INTERVAL_HOURS) as number;
    const auditEnabledDefault = specDefault(REPACK_AUDIT_ENABLED) as boolean;
    const auditIntervalHoursDefault = specDefault(REPACK_AUDIT_INTERVAL_HOURS) as number;
    const fullImportDefault = specDefault(REPACK_FULL_IMPORT_COMPLETE) as boolean;
    return {
      enabled: settingBool(await this.dependencies.settingsRepository.get(REPACK_ENABLED), enabledDefault),
      baseUrl: (await this.dependencies.settingsRepository.get(REPACK_BASE_URL)) ?? baseUrlDefault,
      intervalHours: settingNumber(await this.dependencies.settingsRepository.get(REPACK_INTERVAL_HOURS), intervalHoursDefault),
      auditEnabled: settingBool(await this.dependencies.settingsRepository.get(REPACK_AUDIT_ENABLED), auditEnabledDefault),
      auditIntervalHours: settingNumber(await this.dependencies.settingsRepository.get(REPACK_AUDIT_INTERVAL_HOURS), auditIntervalHoursDefault),
      fullImportComplete: settingBool(await this.dependencies.settingsRepository.get(REPACK_FULL_IMPORT_COMPLETE), fullImportDefault),
      defaults: {
        enabled: enabledDefault,
        baseUrl: baseUrlDefault,
        intervalHours: intervalHoursDefault,
        auditEnabled: auditEnabledDefault,
        auditIntervalHours: auditIntervalHoursDefault,
      },
      constraints: {
        baseUrl: REPACK_CATALOG_SETTING_SPECS.find((spec) => spec.key === REPACK_BASE_URL)?.constraints,
        intervalHours: REPACK_CATALOG_SETTING_SPECS.find((spec) => spec.key === REPACK_INTERVAL_HOURS)?.constraints,
        auditIntervalHours: REPACK_CATALOG_SETTING_SPECS.find((spec) => spec.key === REPACK_AUDIT_INTERVAL_HOURS)?.constraints,
      },
    };
  }

  async updateSettings(next: RepackCatalogSettingsUpdate) {
    const settingKeys = {
      enabled: REPACK_ENABLED,
      baseUrl: REPACK_BASE_URL,
      intervalHours: REPACK_INTERVAL_HOURS,
      auditEnabled: REPACK_AUDIT_ENABLED,
      auditIntervalHours: REPACK_AUDIT_INTERVAL_HOURS,
    } as const;
    const entries = Object.entries(next).map(([field, value]) => {
      const key = settingKeys[field as keyof typeof settingKeys];
      if (!key) throw new ValidationError(`unknown repack catalog setting: ${field}`);
      return { key, value: String(value) };
    });
    validateSettingEntries(entries, REPACK_CATALOG_USER_SETTING_SPECS);
    const before = await this.settings();
    if (entries.length) await this.dependencies.settingsRepository.setMany(entries);
    const after = await this.settings();
    return { before, after };
  }

  isRunning(): boolean { return this.running; }
  jobStatus() { return { ...this.status, running: this.running }; }
  cancel(): void { this.abortController?.abort(new Error('repack catalog work cancelled')); }
  async sync(fullArchive = false) {
    if (this.running) return { ...this.status, running: true, reason: 'in-progress' as const };
    if (!(await this.enabled())) return { processed: 0, skipped: 0, failed: 0, blocked: false, reason: 'disabled' as const };
    this.running = true;
    const abortController = new AbortController();
    this.abortController = abortController;
    this.status = { phase: 'discovering', processed: 0, skipped: 0, failed: 0, total: 0, startedAt: new Date().toISOString() };
    try {
      const config = await this.settings();
      const source = this.sourceForBase(config.baseUrl);
       await regroupCatalog();
      const rematchable = await this.dependencies.repackCatalogRepository.findRematchableGames();
      const attemptedGames = new Set(rematchable.map((game) => game.normalizedTitle));
      await mapWithLimit(rematchable, SCRAPE_CONCURRENCY, async (game) => {
        try {
          await this.matchGame(game.id, game.posts?.[0]?.title ?? game.title);
        } catch (error) {
          logger.warn({ gameId: game.id, err: (error as Error).message }, 'repack metadata retry failed');
        }
      });
      const urls = await source.discoverPostUrls({ fullArchive, signal: abortController.signal });
      const known = await this.dependencies.repackCatalogRepository.knownUrls(source.name, urls);
      const pending = urls.filter((url) => !known.has(url));
      this.status = { ...this.status, phase: 'scraping', total: pending.length };
      const result = await this.runBatch(pending, abortController.signal, async (url, markSucceeded) => {
        const post = await source.fetchPost(url, abortController.signal);
        if (!post) { this.status.skipped += 1; return; }
        const saved = await this.dependencies.repackCatalogRepository.upsertPost(post);
        this.status.processed += 1;
        markSucceeded();
        const game = saved.game;
        if (game && !attemptedGames.has(game.normalizedTitle) && game.matchStatus === 'PENDING') {
          attemptedGames.add(game.normalizedTitle);
          await this.matchGame(game.id, post.title);
        }
      }, (url, error) => logger.warn({ url, err: (error as Error).message }, 'repack post fetch failed'));
      const { blocked, stoppedAfterErrors, failed: failures } = result;
      this.status.phase = abortController.signal.aborted ? 'cancelled' : blocked ? 'blocked' : stoppedAfterErrors ? 'stopped' : failures ? 'partial' : 'done';
      if (fullArchive && !blocked && !abortController.signal.aborted && failures === 0) {
        await this.dependencies.settingsRepository.set(REPACK_FULL_IMPORT_COMPLETE, 'true');
      }
      return { processed: this.status.processed, skipped: this.status.skipped, failed: failures, blocked, stoppedAfterErrors, cancelled: abortController.signal.aborted };
    } catch (error) {
      const blocked = error instanceof SourceBlockedError;
      const cancelled = abortController.signal.aborted;
      this.status.phase = cancelled ? 'cancelled' : blocked ? 'blocked' : 'failed';
      logger.warn({ err: (error as Error).message, blocked }, 'repack catalog sync stopped');
      return { processed: this.status.processed, skipped: this.status.skipped, failed: this.status.failed + Number(!cancelled), blocked, cancelled };
    } finally {
      if (this.abortController === abortController) this.abortController = null;
      this.running = false;
    }
  }

  async audit() {
    if (this.running || !(await this.enabled())) return { processed: 0, skipped: 0, failed: 0, blocked: false };
    this.running = true;
    const abortController = new AbortController();
    this.abortController = abortController;
    this.status = { phase: 'auditing', processed: 0, skipped: 0, failed: 0, total: 50, startedAt: new Date().toISOString() };
    try {
      const { baseUrl } = await this.settings();
      const source = this.sourceForBase(baseUrl);
      const posts = await this.dependencies.repackCatalogRepository.listAuditPosts(0, 50);
      const result = await this.runBatch(posts, abortController.signal, async (post, markSucceeded) => {
        const parsed = await source.fetchPost(post.sourceUrl, abortController.signal);
        if (parsed) {
          await this.dependencies.repackCatalogRepository.upsertPost(parsed);
          this.status.processed += 1;
        } else this.status.skipped += 1;
        markSucceeded();
        await this.dependencies.repackCatalogRepository.markAuditSeen(post.source, post.sourceUrl);
      });
      await regroupCatalog();
      const { blocked, stoppedAfterErrors } = result;
      this.status.phase = abortController.signal.aborted ? 'cancelled' : blocked ? 'blocked' : stoppedAfterErrors ? 'stopped' : 'done';
      return { processed: this.status.processed, skipped: this.status.skipped, failed: this.status.failed, blocked, stoppedAfterErrors, cancelled: abortController.signal.aborted };
    } catch (error) {
      const cancelled = abortController.signal.aborted;
      this.status.phase = cancelled ? 'cancelled' : 'failed';
      return { processed: this.status.processed, skipped: this.status.skipped, failed: this.status.failed + Number(!cancelled), blocked: error instanceof SourceBlockedError, cancelled };
    } finally {
      if (this.abortController === abortController) this.abortController = null;
      this.running = false;
    }
  }

  list(options: { offset: number; limit: number; query?: string; genres?: string[]; steamDeck?: number[]; matchStatus?: RepackMatchStatus[]; sort?: 'title-asc' | 'title-desc' | 'newest' | 'oldest' }) { return this.dependencies.repackCatalogRepository.listGames(options); }
  genres() { return this.dependencies.repackCatalogRepository.listGenres(); }
  getGame(id: string) { return this.dependencies.repackCatalogRepository.getGame(id); }
  getArtworkGame(id: string) { return this.dependencies.repackCatalogRepository.getArtworkGame(id); }
  review(options: { offset: number; limit: number }) { return this.dependencies.repackCatalogRepository.listReview(options); }
  statusSnapshot() { return this.jobStatus(); }

  async searchCandidates(id: string, query?: string): Promise<RepackMatchCandidate[]> {
    const game = await this.dependencies.repackCatalogRepository.getGame(id);
    if (!game) throw new NotFoundError('RepackGame', id);
    const search = normalizeGameName(query?.trim() || game.title).query;
    if (!search) throw new ValidationError('search query must not be empty');
    const candidates = await this.findCandidates(search);
    await this.dependencies.repackCatalogRepository.saveCandidates(id, candidates, candidates.length ? 'REVIEW' : 'PENDING', candidates[0]?.score ?? null);
    return candidates;
  }

  async acceptCandidate(id: string, providerName: string, remoteId: string) {
    const game = await this.dependencies.repackCatalogRepository.getGame(id);
    if (!game) throw new NotFoundError('RepackGame', id);
    const candidate = (game.matchCandidates as RepackMatchCandidate[]).find(
      (item) => item.providerName === providerName && item.remoteId === remoteId,
    );
    if (!candidate) throw new ValidationError('candidate not found; search candidates first');
    const provider = this.dependencies.providerRegistry.resolve(providerName);
    if (!provider) throw new ValidationError(`unknown provider: ${providerName}`);
    const snapshot = await provider.getGame(remoteId);
    if (!snapshot) throw new NotFoundError('ProviderGame', remoteId);
    return this.dependencies.repackCatalogRepository.acceptMatch(id, candidate, snapshotFrom(snapshot));
  }

  async previewCandidate(id: string, providerName: string, remoteId: string) {
    const game = await this.dependencies.repackCatalogRepository.getGame(id);
    if (!game) throw new NotFoundError('RepackGame', id);
    const provider = this.dependencies.providerRegistry.resolve(providerName);
    if (!provider) throw new ValidationError(`unknown provider: ${providerName}`);
    const allowed = (game.matchCandidates as RepackMatchCandidate[]).some(
      (candidate) => candidate.providerName === providerName && candidate.remoteId === remoteId,
    );
    if (!allowed) throw new ValidationError('candidate not found; search candidates first');
    const metadata = await provider.getGame(remoteId);
    if (!metadata) throw new NotFoundError('ProviderGame', remoteId);
    return metadata;
  }

  rejectCandidate(id: string) { return this.dependencies.repackCatalogRepository.rejectMatch(id); }

  private async findCandidates(title: string): Promise<RepackMatchCandidate[]> {
    const results: SearchResult[] = [];
    for (const provider of this.dependencies.providerRegistry.order()) {
      try { results.push(...await provider.search(title)); }
      catch (error) { logger.warn({ provider: provider.name, err: (error as Error).message }, 'repack metadata search failed'); }
    }
    return results.map(candidateFrom).sort((a, b) => b.score - a.score).slice(0, 12);
  }

  private sourceForBase(baseUrl: string): RepackSource {
    if (this.sourceCache?.baseUrl === baseUrl) return this.sourceCache.source;
    const source = this.dependencies.sourceFactory(baseUrl);
    this.sourceCache = { baseUrl, source };
    return source;
  }

  private async runBatch<T>(
    items: T[],
    signal: AbortSignal,
    work: (item: T, markSucceeded: () => void) => Promise<void>,
    onFailure?: (item: T, error: unknown) => void,
  ): Promise<{ blocked: boolean; stoppedAfterErrors: boolean; failed: number }> {
    let blocked = false;
    let stoppedAfterErrors = false;
    let failed = 0;
    let consecutiveFailures = 0;
    await mapWithLimit(items, SCRAPE_CONCURRENCY, async (item) => {
      if (blocked || stoppedAfterErrors || signal.aborted) return;
      try {
        await work(item, () => { consecutiveFailures = 0; });
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof SourceBlockedError) { blocked = true; return; }
        failed += 1;
        consecutiveFailures += 1;
        this.status.failed += 1;
        onFailure?.(item, error);
        if (consecutiveFailures >= 3) stoppedAfterErrors = true;
      }
    });
    return { blocked, stoppedAfterErrors, failed };
  }

  private async matchGame(id: string, title: string): Promise<void> {
    const displayTitle = fitGirlGameTitle(decodeHtmlEntities(title));
    const fullQuery = normalizeGameName(displayTitle).query;
    let candidates = await this.findCandidates(fullQuery);
    const decision = decideMatch(candidates, this.dependencies.matchThresholds);
    let reviewCandidates: RepackMatchCandidate[] | null = null;
    let reviewScore = -1;
    let reviewWasFlagged = false;

    if (decision.status === MatchStatus.ACCEPTED) {
      if (await this.acceptBestCandidate(id, candidates, this.dependencies.matchThresholds.acceptThreshold)) return;
      reviewCandidates = candidates;
      reviewScore = decision.score;
    } else if (decision.status === MatchStatus.FLAGGED) {
      reviewCandidates = candidates;
      reviewScore = decision.score;
      reviewWasFlagged = true;
    }

    const baseTitle = stripEditionPhrase(displayTitle);
    const baseQuery = baseTitle ? normalizeGameName(baseTitle).query : '';
    if (baseQuery && baseQuery !== fullQuery) {
      const baseCandidates = await this.findCandidates(baseQuery);
      const baseDecision = decideMatch(baseCandidates, this.dependencies.matchThresholds);
      if (baseDecision.status === MatchStatus.ACCEPTED) {
        if (await this.acceptBestCandidate(id, baseCandidates, this.dependencies.matchThresholds.acceptThreshold)) return;
        if (!reviewWasFlagged || baseDecision.score > reviewScore) {
          reviewCandidates = baseCandidates;
          reviewScore = baseDecision.score;
          reviewWasFlagged = false;
        }
      } else if (baseDecision.status === MatchStatus.FLAGGED && (!reviewWasFlagged || baseDecision.score >= reviewScore)) {
        reviewCandidates = baseCandidates;
        reviewScore = baseDecision.score;
        reviewWasFlagged = true;
      }
    }

    if (reviewCandidates) {
      await this.dependencies.repackCatalogRepository.saveCandidates(id, reviewCandidates, 'REVIEW', reviewScore);
      return;
    }

    await this.dependencies.repackCatalogRepository.saveCandidates(id, candidates, repackStatusFromDecision(decision), decision.score);
  }

  private async acceptBestCandidate(
    id: string,
    candidates: RepackMatchCandidate[],
    acceptThreshold: number,
  ): Promise<boolean> {
    for (const candidate of candidates) {
      if (candidate.score < acceptThreshold) break;
      const provider: MetadataProvider | null = this.dependencies.providerRegistry.resolve(candidate.providerName);
      if (!provider) continue;
      const metadata = await provider.getGame(candidate.remoteId).catch((error) => {
        logger.warn({ provider: provider.name, remoteId: candidate.remoteId, err: (error as Error).message }, 'repack metadata fetch failed');
        return null;
      });
      if (!metadata) continue;
      await this.dependencies.repackCatalogRepository.acceptMatch(id, candidate, snapshotFrom(metadata));
      return true;
    }
    return false;
  }
}

export function createRepackCatalogService(dependencies: RepackCatalogServiceDependencies): RepackCatalogService {
  return new RepackCatalogService(dependencies);
}
