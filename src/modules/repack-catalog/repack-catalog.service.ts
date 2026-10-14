import { logger } from '../../logger/index.js';
import { normalizeGameName } from '../../shared/normalize.js';
import { MatchStatus } from '../../shared/enums.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { providerRegistry } from '../metadata/provider-registry.js';
import { settingsRepository } from '../settings/settings.repository.js';
import type { GameMetadata, MetadataProvider, SearchResult } from '../../shared/types.js';
import { repackCatalogRepository } from './repack-catalog.repository.js';
import { FitGirlSource, fitGirlGameTitle, normalizeFitGirlGameTitle } from './sources/fitgirl/fitgirl.source.js';
import { repackSourceRegistry } from './sources/source-registry.js';
import { SourceBlockedError } from './source-http-client.js';
import type { RepackMatchCandidate, RepackMatchStatus, RepackMetadataSnapshot, RepackSource } from './repack-catalog.types.js';
import { decideMatch } from '../scanner/match-policy.js';

export const REPACK_ENABLED = 'repackCatalogEnabled';
export const REPACK_BASE_URL = 'repackCatalogFitGirlBaseUrl';
export const REPACK_INTERVAL_HOURS = 'repackCatalogIntervalHours';
export const REPACK_AUDIT_ENABLED = 'repackCatalogAuditEnabled';
export const REPACK_AUDIT_INTERVAL_HOURS = 'repackCatalogAuditIntervalHours';
export const REPACK_FULL_IMPORT_COMPLETE = 'repackCatalogFullImportComplete';
const DEFAULT_BASE_URL = 'https://fitgirl-repacks.site/';
const FULL_IMPORT_SETTING = REPACK_FULL_IMPORT_COMPLETE;
const SCRAPE_CONCURRENCY = 2;

repackSourceRegistry.register('fitgirl', (url) => new FitGirlSource(url));

function settingBool(value: string | null, fallback: boolean): boolean { return value === null ? fallback : value === 'true'; }
function settingNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function candidateFrom(result: SearchResult): RepackMatchCandidate {
  return {
    providerName: result.providerName, remoteId: result.remoteId, title: result.title,
    releaseYear: result.releaseYear, coverUrl: result.coverUrl, score: result.score ?? 0,
  };
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
    steamDeckCompat: metadata.steamDeckCompat ? {
      category: metadata.steamDeckCompat.category,
      items: metadata.steamDeckCompat.items.map((item) => ({ displayType: item.displayType, locToken: item.locToken })),
    } : undefined,
  };
}

async function regroupCatalog(): Promise<void> {
  await repackCatalogRepository.regroupGames((title) => ({
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

  async enabled(): Promise<boolean> { return settingBool(await settingsRepository.get(REPACK_ENABLED), false); }

  async settings() {
    return {
      enabled: await this.enabled(),
      baseUrl: (await settingsRepository.get(REPACK_BASE_URL)) ?? DEFAULT_BASE_URL,
      intervalHours: settingNumber(await settingsRepository.get(REPACK_INTERVAL_HOURS), 24),
      auditEnabled: settingBool(await settingsRepository.get(REPACK_AUDIT_ENABLED), false),
      auditIntervalHours: settingNumber(await settingsRepository.get(REPACK_AUDIT_INTERVAL_HOURS), 720),
      fullImportComplete: settingBool(await settingsRepository.get(FULL_IMPORT_SETTING), false),
    };
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
      if (!source) throw new Error('FitGirl source not registered');
      await regroupCatalog();
      const rematchable = await repackCatalogRepository.findRematchableGames();
      const attemptedGames = new Set(rematchable.map((game) => game.normalizedTitle));
      await mapWithLimit(rematchable, SCRAPE_CONCURRENCY, async (game) => {
        try {
          await this.matchGame(game.id, game.title);
        } catch (error) {
          logger.warn({ gameId: game.id, err: (error as Error).message }, 'repack metadata retry failed');
        }
      });
      const urls = await source.discoverPostUrls({ fullArchive, signal: abortController.signal });
      const known = await repackCatalogRepository.knownUrls(source.name, urls);
      const pending = urls.filter((url) => !known.has(url));
      this.status = { ...this.status, phase: 'scraping', total: pending.length };
      let blocked = false;
      let stoppedAfterErrors = false;
      let failures = 0;
      let consecutiveFailures = 0;
      await mapWithLimit(pending, SCRAPE_CONCURRENCY, async (url) => {
        if (blocked || stoppedAfterErrors || abortController.signal.aborted) return;
        try {
          const post = await source.fetchPost(url, abortController.signal);
          if (!post) { this.status.skipped += 1; return; }
          const saved = await repackCatalogRepository.upsertPost(post);
          this.status.processed += 1;
          consecutiveFailures = 0;
          const game = saved.game;
          if (game && !attemptedGames.has(game.normalizedTitle) && game.matchStatus === 'PENDING') {
            attemptedGames.add(game.normalizedTitle);
            await this.matchGame(game.id, game.title);
          }
        } catch (error) {
          if (abortController.signal.aborted) return;
          if (error instanceof SourceBlockedError) { blocked = true; return; }
          failures += 1;
          consecutiveFailures += 1;
          this.status.failed += 1;
          logger.warn({ url, err: (error as Error).message }, 'repack post fetch failed');
          if (consecutiveFailures >= 3) stoppedAfterErrors = true;
        }
      });
      this.status.phase = abortController.signal.aborted ? 'cancelled' : blocked ? 'blocked' : stoppedAfterErrors ? 'stopped' : failures ? 'partial' : 'done';
      if (fullArchive && !blocked && !abortController.signal.aborted && failures === 0) await settingsRepository.set(FULL_IMPORT_SETTING, 'true');
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
      if (!source) throw new Error('FitGirl source not registered');
      const posts = await repackCatalogRepository.listAuditPosts(0, 50);
      let blocked = false;
      let stoppedAfterErrors = false;
      let consecutiveFailures = 0;
      await mapWithLimit(posts, SCRAPE_CONCURRENCY, async (post) => {
        if (blocked || stoppedAfterErrors || abortController.signal.aborted) return;
        try {
          const parsed = await source.fetchPost(post.sourceUrl, abortController.signal);
          if (parsed) {
            await repackCatalogRepository.upsertPost(parsed);
            this.status.processed += 1;
          } else this.status.skipped += 1;
          consecutiveFailures = 0;
          await repackCatalogRepository.markAuditSeen(post.source, post.sourceUrl);
        } catch (error) {
          if (abortController.signal.aborted) return;
          if (error instanceof SourceBlockedError) blocked = true;
          else {
            this.status.failed += 1;
            consecutiveFailures += 1;
            if (consecutiveFailures >= 3) stoppedAfterErrors = true;
          }
        }
      });
      await regroupCatalog();
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

  list(options: { offset: number; limit: number; query?: string }) { return repackCatalogRepository.listGames(options); }
  getGame(id: string) { return repackCatalogRepository.getGame(id); }
  review(options: { offset: number; limit: number }) { return repackCatalogRepository.listReview(options); }
  statusSnapshot() { return this.jobStatus(); }

  async searchCandidates(id: string, query?: string): Promise<RepackMatchCandidate[]> {
    const game = await repackCatalogRepository.getGame(id);
    if (!game) throw new NotFoundError('RepackGame', id);
    const search = normalizeGameName(query?.trim() || game.title).query;
    if (!search) throw new ValidationError('search query must not be empty');
    const candidates = await this.findCandidates(search);
    await repackCatalogRepository.saveCandidates(id, candidates, candidates.length ? 'REVIEW' : 'PENDING', candidates[0]?.score ?? null);
    return candidates;
  }

  async acceptCandidate(id: string, providerName: string, remoteId: string) {
    const game = await repackCatalogRepository.getGame(id);
    if (!game) throw new NotFoundError('RepackGame', id);
    const candidate = (game.matchCandidates as RepackMatchCandidate[]).find(
      (item) => item.providerName === providerName && item.remoteId === remoteId,
    );
    if (!candidate) throw new ValidationError('candidate not found; search candidates first');
    const provider = providerRegistry.resolve(providerName);
    if (!provider) throw new ValidationError(`unknown provider: ${providerName}`);
    const snapshot = await provider.getGame(remoteId);
    if (!snapshot) throw new NotFoundError('ProviderGame', remoteId);
    return repackCatalogRepository.acceptMatch(id, candidate, snapshotFrom(snapshot));
  }

  async previewCandidate(id: string, providerName: string, remoteId: string) {
    const game = await repackCatalogRepository.getGame(id);
    if (!game) throw new NotFoundError('RepackGame', id);
    const provider = providerRegistry.resolve(providerName);
    if (!provider) throw new ValidationError(`unknown provider: ${providerName}`);
    const allowed = (game.matchCandidates as RepackMatchCandidate[]).some(
      (candidate) => candidate.providerName === providerName && candidate.remoteId === remoteId,
    );
    if (!allowed) throw new ValidationError('candidate not found; search candidates first');
    const metadata = await provider.getGame(remoteId);
    if (!metadata) throw new NotFoundError('ProviderGame', remoteId);
    return metadata;
  }

  rejectCandidate(id: string) { return repackCatalogRepository.rejectMatch(id); }

  private async findCandidates(title: string): Promise<RepackMatchCandidate[]> {
    const results: SearchResult[] = [];
    for (const provider of providerRegistry.order()) {
      try { results.push(...await provider.search(title)); }
      catch (error) { logger.warn({ provider: provider.name, err: (error as Error).message }, 'repack metadata search failed'); }
    }
    return results.map(candidateFrom).sort((a, b) => b.score - a.score).slice(0, 12);
  }

  private sourceForBase(baseUrl: string): RepackSource | null {
    if (this.sourceCache?.baseUrl === baseUrl) return this.sourceCache.source;
    const source = repackSourceRegistry.create('fitgirl', baseUrl);
    if (source) this.sourceCache = { baseUrl, source };
    return source;
  }

  private async matchGame(id: string, title: string): Promise<void> {
    const candidates = await this.findCandidates(title);
    const decision = decideMatch(candidates);
    const status: RepackMatchStatus = decision.status === MatchStatus.ACCEPTED ? 'MATCHED'
      : decision.status === MatchStatus.FLAGGED ? 'REVIEW'
        : decision.status === MatchStatus.REJECTED ? 'REJECTED' : 'PENDING';
    if (decision.status !== MatchStatus.ACCEPTED || !decision.result) {
      await repackCatalogRepository.saveCandidates(id, candidates, status, decision.score);
      return;
    }

    const candidate = candidates.find((item) => item.providerName === decision.result?.providerName && item.remoteId === decision.result.remoteId);
    const provider: MetadataProvider | null = candidate ? providerRegistry.resolve(candidate.providerName) : null;
    const metadata = candidate && provider ? await provider.getGame(candidate.remoteId).catch(() => null) : null;
    if (!candidate || !metadata) {
      await repackCatalogRepository.saveCandidates(id, candidates, 'REVIEW', decision.score);
      return;
    }
    await repackCatalogRepository.acceptMatch(id, candidate, snapshotFrom(metadata));
  }
}

export const repackCatalogService = new RepackCatalogService();
