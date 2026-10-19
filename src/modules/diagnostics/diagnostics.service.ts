import { config } from '../../config/index.js';
import { version } from '../../app-version.js';
import { MatchStatus, RE_MATCHABLE_STATUSES, STEAM_PROVIDER_NAME } from '../../shared/enums.js';
import { decideMatch, type MatchDecision } from '../../shared/match-policy.js';
import { normalizeGameName } from '../../shared/normalize.js';
import type { MetadataProvider, SearchResult } from '../../shared/types.js';
import { providerMatchRepository } from '../metadata/provider-match.repository.js';
import { providerRegistry } from '../metadata/provider-registry.js';
import { createLibraryRepository } from '../library/library.repository.js';
import type { Game } from '../library/library.types.js';

const MISSING_FIELDS = ['description', 'coverUrl', 'headerUrl', 'heroUrl'] as const;
const MAX_CANDIDATES_PER_PROVIDER = 5;
const ALLOWED_ARTWORK_HOSTS = ['steamstatic.com', 'images.igdb.com', 'steamgriddb.com'];

type DiagnosticIssue = 'unmatched' | `missing-${typeof MISSING_FIELDS[number]}` | 'diagnosis-error';

export interface ProblemGame {
  id: string;
  game: Game;
  issues: DiagnosticIssue[];
}

export interface DiagnosticPreparation {
  totalGames: number;
  problemGames: ProblemGame[];
}

interface ArtworkProbeResult {
  status: 'available' | 'unavailable' | 'redirect' | 'unsupported' | 'error';
  statusCode?: number;
  error?: string;
}

export interface GameDiagnosis {
  gameId: string;
  entryName: string;
  matchStatus: string;
  matchScore: number | null;
  steamAppId: number | null;
  issues: DiagnosticIssue[];
  providerMatches: Array<{
    providerName: string;
    remoteId: string;
    matchScore: number | null;
    isPrimary: boolean;
  }>;
  search: {
    query: string;
    providers: Array<{
      providerName: string;
      status: 'ok' | 'error';
      resultCount: number;
      candidates: Array<Pick<SearchResult, 'remoteId' | 'title' | 'releaseYear' | 'score' | 'coverUrl'>>;
      error?: string;
    }>;
    decision: { status: string; score: number; result: SearchResult | null; assessment: string };
  };
  matchedMetadata: {
    providerName: string;
    remoteId: string;
    status: 'ok' | 'not-found' | 'provider-unavailable' | 'error' | 'not-attempted';
    fields?: Record<string, boolean>;
    error?: string;
  } | null;
  artworkProbes: Array<{
    kind: string;
    url: string;
    status: ArtworkProbeResult['status'];
    statusCode?: number;
    error?: string;
  }>;
  error?: string;
}

export interface DiagnosticReport {
  formatVersion: 1;
  generatedAt: string;
  appVersion: string;
  note: string;
  environment: { nodeEnv: string; logLevel: string };
  configuration: {
    matchThresholds: { accept: number; flag: number };
    credentialsConfigured: { steamApiKey: boolean; igdb: boolean; steamGridDb: boolean };
  };
  providerHealth: Array<{ name: string; enabled: boolean; detail: string }>;
  summary: {
    totalGames: number;
    problemGames: number;
    healthyGames: number;
    issues: Record<string, number>;
    diagnosisErrors: number;
  };
  games: GameDiagnosis[];
}

export interface DiagnosticsServiceDeps {
  games: Pick<ReturnType<typeof createLibraryRepository>, 'listAll'>;
  providerMatches: Pick<typeof providerMatchRepository, 'findByGame'>;
  providers: MetadataProvider[];
  providerHealth: DiagnosticReport['providerHealth'];
  now: () => Date;
  appVersion: string;
  artworkProbe: (url: string) => Promise<ArtworkProbeResult>;
}

function hasMissingValue(game: Game, field: typeof MISSING_FIELDS[number]): boolean {
  const value = game[field];
  return typeof value !== 'string' || value.trim().length === 0;
}

function hasNoMatch(game: Game, hasProviderMatch: boolean): boolean {
  if (RE_MATCHABLE_STATUSES.includes(game.matchStatus)) return true;
  return game.matchStatus === MatchStatus.MANUAL && game.steamAppId === null && !hasProviderMatch;
}

function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return rawUrl.split(/[?#]/u, 1)[0];
  }
}

function safeError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [config.igdb.clientSecret, config.steamIndex.apiKey, config.steamgriddb.apiKey]) {
    if (secret) message = message.split(secret).join('[redacted]');
  }
  return message.replace(/https?:\/\/[^\s"']+/gu, (value) => redactUrl(value));
}

function assessment(decision: MatchDecision, providerErrors: number): string {
  if (decision.status === MatchStatus.ACCEPTED) return 'top candidate meets accept threshold';
  if (decision.status === MatchStatus.FLAGGED) return 'top candidate meets review threshold';
  if (decision.status === MatchStatus.REJECTED) return 'top candidate is below review threshold';
  if (providerErrors > 0 && decision.result === null) return 'provider search failed without results';
  if (decision.result === null) return 'providers returned no results';
  return 'no match decision reached';
}

function isAllowedArtworkUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && ALLOWED_ARTWORK_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

async function probeArtworkUrl(url: string): Promise<ArtworkProbeResult> {
  if (!isAllowedArtworkUrl(url)) return { status: 'unsupported' };
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(config.artwork.headerTimeoutMs),
    });
    if (response.status >= 300 && response.status < 400) {
      return { status: 'redirect', statusCode: response.status };
    }
    return {
      status: response.ok ? 'available' : 'unavailable',
      statusCode: response.status,
    };
  } catch (error) {
    return { status: 'error', error: safeError(error) };
  }
}

function defaultProviderHealth(providers: MetadataProvider[]): DiagnosticReport['providerHealth'] {
  const names = new Set(providers.map((provider) => provider.name));
  return [
    {
      name: 'steam',
      enabled: names.has(STEAM_PROVIDER_NAME),
      detail: names.has(STEAM_PROVIDER_NAME)
        ? `Steam provider active; API key configured: ${config.steamIndex.enabled}`
        : 'Steam provider unavailable',
    },
    {
      name: 'igdb',
      enabled: names.has('igdb'),
      detail: names.has('igdb') ? 'IGDB provider active' : 'IGDB credentials missing or provider disabled',
    },
    {
      name: 'steamgriddb',
      enabled: config.steamgriddb.enabled,
      detail: config.steamgriddb.enabled ? 'SteamGridDB credentials configured' : 'SteamGridDB credentials missing',
    },
  ];
}

export class DiagnosticsService {
  private readonly providersByName: Map<string, MetadataProvider>;
  private providerHealth: DiagnosticReport['providerHealth'];

  constructor(private readonly deps: DiagnosticsServiceDeps) {
    this.providersByName = new Map(deps.providers.map((provider) => [provider.name, provider]));
    this.providerHealth = [...deps.providerHealth];
  }

  async prepare(): Promise<DiagnosticPreparation> {
    const games = await this.deps.games.listAll();
    if (games.length > 0) await this.probeIgdbHealth();
    const manualMatches = new Set<string>();
    await Promise.all(games
      .filter((game) => game.matchStatus === MatchStatus.MANUAL && game.steamAppId === null)
      .map(async (game) => {
        const matches = await this.deps.providerMatches.findByGame(game.id);
        if (matches.length > 0) manualMatches.add(game.id);
      }));
    const problemGames = games.flatMap((game) => {
      const issues: DiagnosticIssue[] = [];
      if (hasNoMatch(game, manualMatches.has(game.id))) issues.push('unmatched');
      for (const field of MISSING_FIELDS) {
        if (hasMissingValue(game, field)) issues.push(`missing-${field}`);
      }
      return issues.length > 0 ? [{ id: game.id, game, issues }] : [];
    });
    return { totalGames: games.length, problemGames };
  }

  async diagnose(problem: ProblemGame): Promise<GameDiagnosis> {
    const { game, issues } = problem;
    const query = normalizeGameName(game.entryName).query;
    const providerMatches = await this.deps.providerMatches.findByGame(game.id);
    const searches: GameDiagnosis['search']['providers'] = [];
    const allResults: SearchResult[] = [];

    for (const provider of this.deps.providers) {
      try {
        const results = await provider.search(query);
        allResults.push(...results);
        searches.push({
          providerName: provider.name,
          status: 'ok',
          resultCount: results.length,
          candidates: [...results]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, MAX_CANDIDATES_PER_PROVIDER)
            .map((result) => ({
              ...result,
              ...(result.coverUrl ? { coverUrl: redactUrl(result.coverUrl) } : {}),
            })),
        });
      } catch (error) {
        searches.push({
          providerName: provider.name,
          status: 'error',
          resultCount: 0,
          candidates: [],
          error: safeError(error),
        });
      }
    }

    const decision = decideMatch(allResults, config.match);
    const primary = providerMatches.find((match) => match.isPrimary)
      ?? (game.steamAppId !== null
        ? { providerName: STEAM_PROVIDER_NAME, remoteId: String(game.steamAppId) }
        : null);
    const metadata = await this.fetchMatchedMetadata(primary);
    const artworkCandidates = new Map<string, { kind: string; url: string }>();
    for (const [kind, url] of [
      ['cover', game.coverUrl], ['header', game.headerUrl], ['hero', game.heroUrl], ['logo', game.logoUrl],
      ['cover', metadata.urls?.coverUrl], ['header', metadata.urls?.headerUrl],
      ['hero', metadata.urls?.heroUrl], ['logo', metadata.urls?.logoUrl],
    ] as Array<[string, string | null | undefined]>) {
      if (url) artworkCandidates.set(`${kind}:${url}`, { kind, url });
    }
    const artworkProbes = await Promise.all([...artworkCandidates.values()].map(async ({ kind, url }) => {
      const result = await this.deps.artworkProbe(url);
      return {
        kind,
        url: redactUrl(url),
        status: result.status,
        ...(result.statusCode !== undefined ? { statusCode: result.statusCode } : {}),
        ...(result.error ? { error: safeError(result.error) } : {}),
      };
    }));

    return {
      gameId: game.id,
      entryName: game.entryName,
      matchStatus: game.matchStatus,
      matchScore: game.matchScore,
      steamAppId: game.steamAppId,
      issues,
      providerMatches: providerMatches.map((match) => ({
        providerName: match.providerName,
        remoteId: match.remoteId,
        matchScore: match.matchScore,
        isPrimary: match.isPrimary,
      })),
      search: {
        query,
        providers: searches,
        decision: {
          status: decision.status,
          score: decision.score,
          result: decision.result
            ? { ...decision.result, ...(decision.result.coverUrl ? { coverUrl: redactUrl(decision.result.coverUrl) } : {}) }
            : null,
          assessment: assessment(decision, searches.filter((result) => result.status === 'error').length),
        },
      },
      matchedMetadata: metadata.report,
      artworkProbes,
    };
  }

  createReport(preparation: DiagnosticPreparation, games: GameDiagnosis[]): DiagnosticReport {
    const issueCounts: Record<string, number> = {};
    for (const game of games) {
      for (const issue of game.issues) issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
    }
    return {
      formatVersion: 1,
      generatedAt: this.deps.now().toISOString(),
      appVersion: this.deps.appVersion,
      note: 'Current-state read-only diagnosis; does not capture errors from original scans.',
      environment: { nodeEnv: config.nodeEnv, logLevel: config.logLevel },
      configuration: {
        matchThresholds: {
          accept: config.match.acceptThreshold,
          flag: config.match.flagThreshold,
        },
        credentialsConfigured: {
          steamApiKey: config.steamIndex.enabled,
          igdb: config.igdb.enabled,
          steamGridDb: config.steamgriddb.enabled,
        },
      },
      providerHealth: this.providerHealth,
      summary: {
        totalGames: preparation.totalGames,
        problemGames: games.length,
        healthyGames: Math.max(0, preparation.totalGames - preparation.problemGames.length),
        issues: issueCounts,
        diagnosisErrors: games.filter((game) => game.error !== undefined).length,
      },
      games,
    };
  }

  private async fetchMatchedMetadata(
    match: { providerName: string; remoteId: string } | null,
  ): Promise<{
    report: NonNullable<GameDiagnosis['matchedMetadata']> | null;
    urls?: Record<string, string | undefined>;
  }> {
    if (!match) return { report: null };
    const provider = this.providersByName.get(match.providerName);
    if (!provider) {
      return {
        report: { ...match, status: 'provider-unavailable' },
      };
    }
    try {
      const metadata = await provider.getGame(match.remoteId);
      if (!metadata) return { report: { ...match, status: 'not-found' } };
      const urls = {
        coverUrl: metadata.coverUrl,
        headerUrl: metadata.headerUrl,
        heroUrl: metadata.heroUrl,
        logoUrl: metadata.logoUrl,
      };
      return {
        report: {
          ...match,
          status: 'ok',
          fields: {
            title: Boolean(metadata.title),
            description: Boolean(metadata.description),
            coverUrl: Boolean(metadata.coverUrl),
            headerUrl: Boolean(metadata.headerUrl),
            heroUrl: Boolean(metadata.heroUrl),
            logoUrl: Boolean(metadata.logoUrl),
          },
        },
        urls,
      };
    } catch (error) {
      return { report: { ...match, status: 'error', error: safeError(error) } };
    }
  }

  private async probeIgdbHealth(): Promise<void> {
    const igdb = this.providersByName.get('igdb');
    if (!igdb) return;

    try {
      const results = await igdb.search('kr8bit diagnostics health check');
      this.providerHealth = this.providerHealth.map((provider) => provider.name === 'igdb'
        ? { ...provider, detail: `IGDB API probe succeeded (${results.length} results)` }
        : provider);
    } catch (error) {
      this.providerHealth = this.providerHealth.map((provider) => provider.name === 'igdb'
        ? { ...provider, detail: `IGDB API probe failed: ${safeError(error)}` }
        : provider);
    }
  }
}

export function createDiagnosticsService(scope?: string): DiagnosticsService {
  const providers = providerRegistry.order();
  return new DiagnosticsService({
    games: createLibraryRepository(scope),
    providerMatches: providerMatchRepository,
    providers,
    providerHealth: defaultProviderHealth(providers),
    now: () => new Date(),
    appVersion: version,
    artworkProbe: probeArtworkUrl,
  });
}
