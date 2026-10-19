import { describe, expect, it, vi } from 'vitest';
import { DiagnosticsService } from '../src/modules/diagnostics/diagnostics.service.js';
import { MatchStatus } from '../src/shared/enums.js';
import type { Game } from '../src/modules/library/library.types.js';
import type { MetadataProvider } from '../src/shared/types.js';

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    entryPath: '/private/library/Example.7z',
    entryType: 'ARCHIVE',
    entryName: 'Example.7z',
    originalEntryName: null,
    releaseVersion: null,
    releaseDlcs: [],
    releaseGroup: null,
    sizeBytes: 100,
    steamAppId: null,
    title: null,
    displayName: 'Example',
    releaseYear: null,
    description: null,
    developers: [],
    publishers: [],
    genres: [],
    coverUrl: null,
    headerUrl: null,
    heroUrl: null,
    logoUrl: null,
    screenshots: [],
    videos: [],
    steamDeckCategory: null,
    steamDeckItems: [],
    matchStatus: MatchStatus.PENDING,
    matchScore: null,
    matchedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeService(options: {
  games?: Game[];
  providers?: MetadataProvider[];
  matches?: Array<{ providerName: string; remoteId: string; matchScore: number | null; isPrimary: boolean }>;
  artworkProbe?: (url: string) => Promise<{ status: 'available' | 'unavailable' | 'redirect' | 'unsupported' | 'error'; statusCode?: number }>;
} = {}): DiagnosticsService {
  return new DiagnosticsService({
    games: { listAll: async () => options.games ?? [] },
    providerMatches: { findByGame: async () => options.matches ?? [] },
    providers: options.providers ?? [],
    providerHealth: [],
    now: () => new Date('2026-10-19T12:00:00.000Z'),
    appVersion: 'test-version',
    artworkProbe: options.artworkProbe ?? (async () => ({ status: 'available', statusCode: 200 })),
  });
}

describe('DiagnosticsService', () => {
  it('selects unmatched and incomplete games, excludes healthy games', async () => {
    const healthy = game({
      id: 'healthy',
      matchStatus: MatchStatus.ACCEPTED,
      steamAppId: 620,
      description: 'Complete',
      coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/620/cover.jpg',
      headerUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/620/header.jpg',
      heroUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/620/hero.jpg',
    });
    const incomplete = game({ id: 'incomplete', matchStatus: MatchStatus.ACCEPTED, steamAppId: 4 });
    const service = makeService({ games: [healthy, incomplete] });

    const prepared = await service.prepare();
    const report = service.createReport(prepared, []);

    expect(prepared.totalGames).toBe(2);
    expect(prepared.problemGames.map((item) => item.game.id)).toEqual(['incomplete']);
    expect(report.summary.healthyGames).toBe(1);
  });

  it('does not mark manually matched provider games as unmatched', async () => {
    const manual = game({ id: 'manual', matchStatus: MatchStatus.MANUAL });
    const service = new DiagnosticsService({
      games: { listAll: async () => [manual] },
      providerMatches: {
        findByGame: async () => [{
          id: 'match-1',
          gameId: 'manual',
          providerName: 'igdb',
          remoteId: '42',
          matchScore: 100,
          matchedAt: new Date(),
          isPrimary: true,
          createdAt: new Date(),
        }],
      },
      providers: [],
      providerHealth: [],
      now: () => new Date('2026-10-19T12:00:00.000Z'),
      appVersion: 'test-version',
      artworkProbe: async () => ({ status: 'available' }),
    });

    const prepared = await service.prepare();

    expect(prepared.problemGames[0].issues).not.toContain('unmatched');
    expect(prepared.problemGames[0].issues).toEqual([
      'missing-description', 'missing-coverUrl', 'missing-headerUrl', 'missing-heroUrl',
    ]);
  });

  it('rechecks providers and matched metadata without write collaborators', async () => {
    const result = {
      providerName: 'steam',
      remoteId: '620',
      title: 'Portal 2',
      score: 92,
      coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/620/cover.jpg?token=private',
    };
    const provider: MetadataProvider = {
      name: 'steam',
      search: vi.fn(async () => [result]),
      getGame: vi.fn(async () => ({
        remoteId: '620',
        title: 'Portal 2',
        description: 'Puzzle game',
        developers: [],
        publishers: [],
        genres: [],
        coverUrl: result.coverUrl,
      })),
    };
    const artworkProbe = vi.fn(async () => ({ status: 'available' as const, statusCode: 200 }));
    const service = makeService({
      providers: [provider],
      matches: [{ providerName: 'steam', remoteId: '620', matchScore: 92, isPrimary: true }],
      artworkProbe,
    });

    const diagnosis = await service.diagnose({ game: game(), issues: ['unmatched', 'missing-description'] });

    expect(provider.search).toHaveBeenCalledWith('Example');
    expect(provider.getGame).toHaveBeenCalledWith('620');
    expect(artworkProbe).toHaveBeenCalledTimes(1);
    expect(diagnosis.search.decision.status).toBe(MatchStatus.ACCEPTED);
    expect(diagnosis.matchedMetadata?.fields?.description).toBe(true);
    expect(diagnosis.artworkProbes[0].url).not.toContain('token=private');
    expect(diagnosis.entryName).toBe('Example.7z');
    expect(JSON.stringify(diagnosis)).not.toContain('/private/library');
  });

  it('records provider errors and redacts secret query strings', async () => {
    const provider: MetadataProvider = {
      name: 'steam',
      search: async () => { throw new Error('request failed https://example.invalid/search?token=secret'); },
      getGame: async () => null,
    };
    const service = makeService({ providers: [provider] });

    const diagnosis = await service.diagnose({ game: game(), issues: ['unmatched'] });

    expect(diagnosis.search.providers[0].status).toBe('error');
    expect(diagnosis.search.providers[0].error).not.toContain('token=secret');
    expect(diagnosis.search.decision.assessment).toBe('provider search failed without results');
  });
});
