import { logger } from '../../logger/index.js';
import { getTitleVariants, normalizeGameName, stripEditionPhrase } from '../../shared/normalize.js';
import { config } from '../../config/index.js';
import { MatchStatus } from '../../shared/enums.js';
import { decideMatch, type MatchDecision } from '../../shared/match-policy.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import type { ProviderRegistry } from '../metadata/provider-registry.js';
import type { settingsRepository } from '../settings/settings.repository.js';
import { createSettingsReader } from '../settings/settings.reader.js';
import { validateSettingEntries } from '../settings/settings.service.js';
import type { GameMetadata, MetadataProvider, SearchResult } from '../../shared/types.js';
import type { repackCatalogRepository } from './repack-catalog.repository.js';
import type { regroupRepackGames } from './repack-catalog.regroup.js';
import { libraryRepository } from '../library/library.repository.js';
import { providerMatchRepository } from '../metadata/provider-match.repository.js';
import { artworkService, type ArtworkKind, type ArtworkService } from '../artwork/artwork.service.js';
import { steamGridDbHttpClient, type SteamGridDbHttpClient } from '../artwork/steamgriddb/steamgriddb.http.js';
import { SteamGridDbFallback, type SteamGridDbArtworkKind } from '../artwork/steamgriddb-fallback.js';
import {
  REPACK_AUDIT_ENABLED,
  REPACK_AUDIT_ENABLED_SPEC,
  REPACK_AUDIT_INTERVAL_HOURS,
  REPACK_AUDIT_INTERVAL_HOURS_SPEC,
  REPACK_BASE_URL,
  REPACK_BASE_URL_SPEC,
  REPACK_CATALOG_USER_SETTING_SPECS,
  REPACK_ENABLED,
  REPACK_ENABLED_SPEC,
  REPACK_FULL_IMPORT_COMPLETE_SPEC,
  REPACK_INTERVAL_HOURS,
  REPACK_INTERVAL_HOURS_SPEC,
} from './repack-catalog.settings.js';
import { fitGirlGameTitle, fitGirlSearchTitle, normalizeFitGirlGameTitle } from './sources/fitgirl/fitgirl.source.js';
import { SourceBlockedError } from './source-http-client.js';
import type { RepackMatchCandidate, RepackMatchStatus, RepackMetadataSnapshot, RepackSource } from './repack-catalog.types.js';

const SCRAPE_CONCURRENCY = 2;
const METADATA_REFRESH_BATCH_SIZE = 500;

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
  regroupGames: typeof regroupRepackGames;
  libraryRepository?: Pick<typeof libraryRepository, 'findByNormalizedTitle'>;
  providerMatchRepository?: Pick<typeof providerMatchRepository, 'findPrimaryByGame'>;
  artworkService?: Pick<ArtworkService, 'downloadToCacheGeneric'>;
  steamGridDb?: SteamGridDbHttpClient | null;
  now?: () => Date;
}

export interface RepackArtworkSource {
  providerName: string;
  remoteId: string;
  url: string;
  steamAppId?: number;
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

function snapshotFrom(metadata: GameMetadata, providerName: string, fetchedAt: Date): RepackMetadataSnapshot {
  return {
    remoteId: metadata.remoteId,
    providerName,
    fetchedAt: fetchedAt.toISOString(),
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

  private readonly settingsReader;
  private readonly libraryRepository: Pick<typeof libraryRepository, 'findByNormalizedTitle'>;
  private readonly providerMatchRepository: Pick<typeof providerMatchRepository, 'findPrimaryByGame'>;
  private readonly artwork: Pick<ArtworkService, 'downloadToCacheGeneric'>;
  private readonly steamGridDb: SteamGridDbFallback;
  private readonly now: () => Date;

  constructor(private readonly dependencies: RepackCatalogServiceDependencies) {
    this.settingsReader = createSettingsReader(dependencies.settingsRepository);
    this.libraryRepository = dependencies.libraryRepository ?? libraryRepository;
    this.providerMatchRepository = dependencies.providerMatchRepository ?? providerMatchRepository;
    this.artwork = dependencies.artworkService ?? artworkService;
    this.steamGridDb = new SteamGridDbFallback(dependencies.steamGridDb === undefined ? steamGridDbHttpClient : dependencies.steamGridDb);
    this.now = dependencies.now ?? (() => new Date());
  }

  async enabled(): Promise<boolean> { return this.settingsReader.boolean(REPACK_ENABLED_SPEC); }

  async settings() {
    return {
      enabled: await this.settingsReader.boolean(REPACK_ENABLED_SPEC),
      baseUrl: await this.settingsReader.string(REPACK_BASE_URL_SPEC),
      intervalHours: await this.settingsReader.integer(REPACK_INTERVAL_HOURS_SPEC),
      auditEnabled: await this.settingsReader.boolean(REPACK_AUDIT_ENABLED_SPEC),
      auditIntervalHours: await this.settingsReader.integer(REPACK_AUDIT_INTERVAL_HOURS_SPEC),
      fullImportComplete: await this.settingsReader.boolean(REPACK_FULL_IMPORT_COMPLETE_SPEC),
      defaults: {
        enabled: REPACK_ENABLED_SPEC.default,
        baseUrl: REPACK_BASE_URL_SPEC.default,
        intervalHours: REPACK_INTERVAL_HOURS_SPEC.default,
        auditEnabled: REPACK_AUDIT_ENABLED_SPEC.default,
        auditIntervalHours: REPACK_AUDIT_INTERVAL_HOURS_SPEC.default,
      },
      constraints: {
        baseUrl: REPACK_BASE_URL_SPEC.constraints,
        intervalHours: REPACK_INTERVAL_HOURS_SPEC.constraints,
        auditIntervalHours: REPACK_AUDIT_INTERVAL_HOURS_SPEC.constraints,
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
      await this.regroupCatalog();
      const metadataBudget = { remaining: METADATA_REFRESH_BATCH_SIZE };
      const rematchable = await this.dependencies.repackCatalogRepository.findRematchableGames();
      const attemptedGames = new Set(rematchable.map((game) => game.normalizedTitle));
      await mapWithLimit(rematchable, SCRAPE_CONCURRENCY, async (game) => {
        try {
          await this.matchGame(game.id, game.posts?.[0]?.title ?? game.title, metadataBudget);
        } catch (error) {
          logger.warn({ gameId: game.id, err: (error as Error).message }, 'repack metadata retry failed');
        }
      });
      const urls = await source.discoverPostUrls({ fullArchive, signal: abortController.signal });
      const known = await this.dependencies.repackCatalogRepository.knownUrls(source.name, urls);
      const pending = urls.filter((url) => !known.has(url));
      this.status = { ...this.status, phase: 'scraping', total: pending.length };
      const result = await this.runBatch(pending, abortController.signal, async (url, resetFailureStreak) => {
        const post = await source.fetchPost(url, abortController.signal);
        if (!post) { this.status.skipped += 1; return; }
        const saved = await this.dependencies.repackCatalogRepository.upsertPost(post);
        this.status.processed += 1;
        resetFailureStreak();
        const game = saved.game;
        if (game && !attemptedGames.has(game.normalizedTitle) && game.matchStatus === 'PENDING') {
          attemptedGames.add(game.normalizedTitle);
          await this.matchGame(game.id, post.title, metadataBudget);
        }
      }, (url, error) => logger.warn({ url, err: (error as Error).message }, 'repack post fetch failed'));
      const { blocked, stoppedAfterErrors, failed: failures } = result;
      this.status.phase = abortController.signal.aborted ? 'cancelled' : blocked ? 'blocked' : stoppedAfterErrors ? 'stopped' : failures ? 'partial' : 'done';
      if (fullArchive && !blocked && !abortController.signal.aborted && failures === 0) {
        await this.settingsReader.write(REPACK_FULL_IMPORT_COMPLETE_SPEC, true);
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
      const result = await this.runBatch(posts, abortController.signal, async (post, resetFailureStreak) => {
        const parsed = await source.fetchPost(post.sourceUrl, abortController.signal);
        if (parsed) {
          await this.dependencies.repackCatalogRepository.upsertPost(parsed);
          this.status.processed += 1;
        } else this.status.skipped += 1;
        resetFailureStreak();
        await this.dependencies.repackCatalogRepository.markAuditSeen(post.source, post.sourceUrl);
      });
      await this.regroupCatalog();
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
  async getArtworkSources(id: string, kind: ArtworkKind): Promise<RepackArtworkSource[]> {
    const game = await this.dependencies.repackCatalogRepository.getArtworkGame(id);
    if (!game) throw new NotFoundError('RepackGame', id);

    const sources: RepackArtworkSource[] = [];
    const urlKey = `${kind}Url` as 'coverUrl' | 'headerUrl' | 'heroUrl' | 'logoUrl';
    const snapshotUrl = game.metadataSnapshot?.[urlKey];
    const snapshotProvider = game.providerName ?? game.metadataSnapshot?.providerName;
    if (snapshotUrl && snapshotProvider && game.metadataSnapshot) {
      sources.push({
        providerName: snapshotProvider,
        remoteId: game.metadataSnapshot.remoteId,
        url: snapshotUrl,
      });
    }

    const libraryGame = await this.libraryRepository.findByNormalizedTitle(game.normalizedTitle, kind);
    if (libraryGame) {
      const remoteUrl = libraryGame[urlKey];
      if (remoteUrl) {
        const primaryMatch = await this.providerMatchRepository.findPrimaryByGame(libraryGame.id);
        if (primaryMatch && primaryMatch.providerName !== 'steam') {
          sources.push({ providerName: primaryMatch.providerName, remoteId: primaryMatch.remoteId, url: remoteUrl });
        } else if (libraryGame.steamAppId) {
          sources.push({ providerName: 'steam', remoteId: String(libraryGame.steamAppId), url: remoteUrl, steamAppId: libraryGame.steamAppId });
        } else if (primaryMatch) {
          sources.push({ providerName: primaryMatch.providerName, remoteId: primaryMatch.remoteId, url: remoteUrl });
        } else {
          sources.push({ providerName: 'library', remoteId: libraryGame.id, url: remoteUrl });
        }
      }
    }

    if (kind === 'cover') {
      const bestCandidate = [...game.matchCandidates]
        .sort((left, right) => right.score - left.score)
        .find((candidate) => candidate.score > 0 && candidate.coverUrl);
      if (bestCandidate?.coverUrl) {
        sources.push({
          providerName: bestCandidate.providerName,
          remoteId: bestCandidate.remoteId,
          url: bestCandidate.coverUrl,
        });
      }
    }
    return sources;
  }

  async getSteamGridDbArtworkSource(id: string, kind: ArtworkKind): Promise<RepackArtworkSource | null> {
    const game = await this.dependencies.repackCatalogRepository.getArtworkGame(id);
    if (!game) throw new NotFoundError('RepackGame', id);
    const artworkKind: SteamGridDbArtworkKind | null = kind === 'header' ? 'hero'
      : kind === 'cover' || kind === 'hero' || kind === 'logo' ? kind
        : null;
    if (!artworkKind) return null;
    const snapshot = game.metadataSnapshot;
    const appIdValue = game.providerName === 'steam'
      ? game.providerRemoteId
      : snapshot?.providerName === 'steam' ? snapshot.remoteId : null;
    const steamAppId = appIdValue && /^\d+$/.test(appIdValue) ? Number(appIdValue) : undefined;
    const candidate = [...game.matchCandidates].sort((left, right) => right.score - left.score)[0];
    const title = snapshot?.title ?? candidate?.title ?? game.title;
    const year = snapshot?.releaseYear ?? candidate?.releaseYear ?? undefined;
    const titleVariants = [...new Set([
      ...getTitleVariants(title), ...getTitleVariants(game.title),
    ])];
    const match = await this.steamGridDb.findArtwork({
      steamAppId, title, titleVariants, releaseYear: year, kind: artworkKind,
    });
    if (!match) return null;
    return {
      providerName: 'steamgriddb',
      remoteId: String(match.image.id),
      url: match.image.url,
    };
  }
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
    const metadata = await provider.getGame(remoteId);
    if (!metadata) throw new NotFoundError('ProviderGame', remoteId);
    const snapshot = await this.enrichSnapshot(candidate, metadata, game.title);
    return this.dependencies.repackCatalogRepository.acceptMatch(
      id, candidate, snapshot, game.matchCandidates as RepackMatchCandidate[],
    );
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

  private regroupCatalog(): Promise<void> {
    return this.dependencies.regroupGames((title) => ({
      gameTitle: fitGirlGameTitle(title),
      normalizedTitle: normalizeFitGirlGameTitle(title),
    }));
  }

  private async runBatch<T>(
    items: T[],
    signal: AbortSignal,
    work: (item: T, resetFailureStreak: () => void) => Promise<void>,
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

  private async matchGame(id: string, title: string, metadataBudget: { remaining: number }): Promise<void> {
    const currentGame = await this.dependencies.repackCatalogRepository.getArtworkGame(id);
    if (!currentGame) throw new NotFoundError('RepackGame', id);
    const currentSnapshot = currentGame.metadataSnapshot;
    const metadataCache = new Map<string, RepackMetadataSnapshot | null>();
    const searchTitle = fitGirlSearchTitle(title);
    const normalizedSearch = normalizeGameName(searchTitle);
    const fullQuery = normalizedSearch.query;
    let candidates = await this.findCandidates(fullQuery);
    let decision = decideMatch(candidates, this.dependencies.matchThresholds);
    let reviewCandidates: RepackMatchCandidate[] | null = null;
    let reviewScore = -1;
    let reviewWasFlagged = false;

    if (decision.status === MatchStatus.ACCEPTED) {
      if (await this.acceptBestCandidate(
        id, candidates, this.dependencies.matchThresholds.acceptThreshold,
        currentGame, currentSnapshot, metadataBudget, metadataCache, searchTitle,
      )) return;
      reviewCandidates = candidates;
      reviewScore = decision.score;
    } else if (decision.status === MatchStatus.FLAGGED) {
      reviewCandidates = candidates;
      reviewScore = decision.score;
      reviewWasFlagged = true;
    }

    const baseTitle = stripEditionPhrase(searchTitle);
    const baseQuery = baseTitle ? normalizeGameName(baseTitle).query : '';
    if (baseQuery && baseQuery !== fullQuery) {
      const baseCandidates = await this.findCandidates(baseQuery);
      const baseDecision = decideMatch(baseCandidates, this.dependencies.matchThresholds);
      if (baseDecision.status === MatchStatus.ACCEPTED) {
        if (await this.acceptBestCandidate(
          id, baseCandidates, this.dependencies.matchThresholds.acceptThreshold,
          currentGame, currentSnapshot, metadataBudget, metadataCache, baseTitle ?? searchTitle,
        )) return;
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
      if (baseDecision.score > decision.score && !reviewWasFlagged) {
        candidates = baseCandidates;
        decision = baseDecision;
      }
    }

    if (decision.status === MatchStatus.PENDING && !reviewCandidates) {
      const steamGridDbGame = await this.steamGridDb.findGame(searchTitle, normalizedSearch.yearDetected);
      if (steamGridDbGame) {
        const recovered = await this.findCandidates(steamGridDbGame.name);
        const recoveredDecision = decideMatch(recovered, this.dependencies.matchThresholds);
        if (recoveredDecision.score > 0) {
          candidates = recovered;
          decision = recoveredDecision;
          if (decision.status === MatchStatus.ACCEPTED) {
            if (await this.acceptBestCandidate(
              id, candidates, this.dependencies.matchThresholds.acceptThreshold,
              currentGame, currentSnapshot, metadataBudget, metadataCache, steamGridDbGame.name,
            )) return;
            reviewCandidates = candidates;
            reviewScore = decision.score;
          } else if (decision.status === MatchStatus.FLAGGED) {
            reviewCandidates = candidates;
            reviewScore = decision.score;
            reviewWasFlagged = true;
          }
        }
      }
    }

    if (reviewCandidates) {
      const provisionalCandidate = [...reviewCandidates].sort((left, right) => right.score - left.score)[0];
      const provisionalSnapshot = provisionalCandidate
        ? await this.getCandidateSnapshot(
          provisionalCandidate, currentGame, currentSnapshot, metadataBudget, metadataCache, searchTitle,
        )
        : null;
      const snapshotToSave = provisionalSnapshot ?? (
        currentSnapshot && this.snapshotMatchesCandidate(currentSnapshot, currentGame, provisionalCandidate)
          ? currentSnapshot
          : null
      );
      await this.dependencies.repackCatalogRepository.saveCandidates(
        id, reviewCandidates, 'REVIEW', reviewScore, snapshotToSave,
      );
      return;
    }

    await this.dependencies.repackCatalogRepository.saveCandidates(
      id, candidates, repackStatusFromDecision(decision), decision.score, null,
    );
  }

  private async acceptBestCandidate(
    id: string,
    candidates: RepackMatchCandidate[],
    acceptThreshold: number,
    currentGame: NonNullable<Awaited<ReturnType<typeof this.dependencies.repackCatalogRepository.getArtworkGame>>>,
    currentSnapshot: RepackMetadataSnapshot | null,
    metadataBudget: { remaining: number },
    metadataCache: Map<string, RepackMetadataSnapshot | null>,
    searchTitle: string,
  ): Promise<boolean> {
    for (const candidate of candidates) {
      if (candidate.score < acceptThreshold) break;
      const snapshot = await this.getCandidateSnapshot(
        candidate, currentGame, currentSnapshot, metadataBudget, metadataCache, searchTitle,
      );
      if (!snapshot) continue;
      await this.dependencies.repackCatalogRepository.acceptMatch(
        id, candidate, snapshot, candidates,
      );
      return true;
    }
    return false;
  }

  private snapshotMatchesCandidate(
    snapshot: RepackMetadataSnapshot,
    game: NonNullable<Awaited<ReturnType<typeof this.dependencies.repackCatalogRepository.getArtworkGame>>>,
    candidate?: RepackMatchCandidate,
  ): boolean {
    if (!candidate || snapshot.remoteId !== candidate.remoteId) return false;
    return (snapshot.providerName ?? game.providerName) === candidate.providerName;
  }

  private async getCandidateSnapshot(
    candidate: RepackMatchCandidate,
    game: NonNullable<Awaited<ReturnType<typeof this.dependencies.repackCatalogRepository.getArtworkGame>>>,
    currentSnapshot: RepackMetadataSnapshot | null,
    metadataBudget: { remaining: number },
    metadataCache: Map<string, RepackMetadataSnapshot | null>,
    searchTitle: string,
  ): Promise<RepackMetadataSnapshot | null> {
    const cacheKey = `${candidate.providerName}:${candidate.remoteId}`;
    if (metadataCache.has(cacheKey)) return metadataCache.get(cacheKey) ?? null;
    if (currentSnapshot && this.snapshotMatchesCandidate(currentSnapshot, game, candidate)) {
      const fetchedAt = Date.parse(currentSnapshot.fetchedAt ?? '');
      if (Number.isFinite(fetchedAt) && this.now().getTime() - fetchedAt < config.metadata.refreshMinAgeMs) {
        return currentSnapshot;
      }
    }
    if (metadataBudget.remaining <= 0) return null;
    metadataBudget.remaining -= 1;
    const provider: MetadataProvider | null = this.dependencies.providerRegistry.resolve(candidate.providerName);
    if (!provider) {
      metadataCache.set(cacheKey, null);
      return null;
    }
    const metadata = await provider.getGame(candidate.remoteId).catch((error) => {
      logger.warn({ provider: provider.name, remoteId: candidate.remoteId, err: (error as Error).message }, 'repack metadata fetch failed');
      return null;
    });
    if (!metadata) {
      metadataCache.set(cacheKey, null);
      return null;
    }
    const snapshot = await this.enrichSnapshot(candidate, metadata, searchTitle);
    metadataCache.set(cacheKey, snapshot);
    return snapshot;
  }

  private async enrichSnapshot(
    candidate: RepackMatchCandidate,
    metadata: GameMetadata,
    searchTitle: string,
  ): Promise<RepackMetadataSnapshot> {
    const snapshot = snapshotFrom(metadata, candidate.providerName, this.now());
    const steamAppId = candidate.providerName === 'steam' && /^\d+$/.test(candidate.remoteId)
      ? Number(candidate.remoteId)
      : undefined;
    const titleVariants = [...new Set([
      ...getTitleVariants(metadata.title), ...getTitleVariants(searchTitle),
    ])];
    const directUrls: Partial<Record<ArtworkKind, string>> = {
      cover: snapshot.coverUrl,
      hero: snapshot.heroUrl,
      logo: snapshot.logoUrl,
    };
    for (const kind of ['cover', 'hero', 'logo'] as const) {
      const directUrl = directUrls[kind];
      if (directUrl && await this.artwork.downloadToCacheGeneric(candidate.providerName, candidate.remoteId, kind, directUrl)) {
        continue;
      }
      const fallback = await this.steamGridDb.findArtwork({
        steamAppId, title: metadata.title, titleVariants, releaseYear: metadata.releaseYear, kind,
      });
      const fallbackUrl = fallback?.image.url;
      const cached = fallbackUrl && await this.artwork.downloadToCacheGeneric(
        candidate.providerName, candidate.remoteId, kind, fallbackUrl,
      );
      const selectedUrl = cached ? fallbackUrl : undefined;
      if (kind === 'cover') snapshot.coverUrl = selectedUrl;
      else if (kind === 'hero') snapshot.heroUrl = selectedUrl;
      else snapshot.logoUrl = selectedUrl;
    }

    if (snapshot.headerUrl) {
      const cachedHeader = await this.artwork.downloadToCacheGeneric(
        candidate.providerName, candidate.remoteId, 'header', snapshot.headerUrl,
      );
      if (!cachedHeader) snapshot.headerUrl = undefined;
    }
    if (!snapshot.headerUrl && snapshot.heroUrl) {
      const cachedHeader = await this.artwork.downloadToCacheGeneric(
        candidate.providerName, candidate.remoteId, 'header', snapshot.heroUrl,
      );
      if (cachedHeader) snapshot.headerUrl = snapshot.heroUrl;
    }
    snapshot.fetchedAt = this.now().toISOString();
    return snapshot;
  }
}

export function createRepackCatalogService(dependencies: RepackCatalogServiceDependencies): RepackCatalogService {
  return new RepackCatalogService(dependencies);
}
