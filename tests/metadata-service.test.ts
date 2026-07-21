import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../src/prisma-client.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { providerMatchRepository } from '../src/modules/metadata/provider-match.repository.js';
import { MetadataService } from '../src/modules/metadata/metadata.service.js';
import { MatchStatus } from '../src/shared/enums.js';
import { NotFoundError, ValidationError } from '../src/shared/errors.js';
import type { ArtworkService } from '../src/modules/artwork/artwork.service.js';
import type { ProviderRegistry } from '../src/modules/metadata/provider-registry.js';
import type {
  GameMetadata,
  MetadataProvider,
  SearchResult,
} from '../src/shared/types.js';

const tmpBase = join(os.tmpdir(), 'kr8bit-meta-');
let tmpDir: string;
let tmpArtwork: string;

function mockArtwork(): ArtworkService {
  return {
    cachePath: vi.fn((appId: number, kind: string) => join(tmpArtwork, String(appId), kind)),
    streamPath: vi.fn((appId: number, kind: string) => join(tmpArtwork, String(appId), kind)),
    downloadToCache: vi.fn(async () => '/fake/cache/path'),
    exists: vi.fn(async () => false),
    readWithContentType: vi.fn(async () => null),
    remove: vi.fn(async () => undefined),
    cachePathGeneric: vi.fn(
      (provider: string, remoteId: string, kind: string) =>
        join(tmpArtwork, provider, remoteId, kind),
    ),
    downloadToCacheGeneric: vi.fn(async () => '/fake/cache/generic'),
    readWithContentTypeGeneric: vi.fn(async () => null),
    removeGeneric: vi.fn(async () => undefined),
  } as unknown as ArtworkService;
}

function mockProvider(
  name: string,
  searchResults: SearchResult[],
  metadataByRemoteId: Record<string, GameMetadata>,
): MetadataProvider {
  return {
    name,
    search: vi.fn(async () => searchResults),
    getGame: vi.fn(async (id: string) => metadataByRemoteId[id] ?? null),
  } as unknown as MetadataProvider;
}

function mockRegistry(providers: MetadataProvider[]): ProviderRegistry {
  const byName = new Map(providers.map((p) => [p.name, p]));
  return {
    resolve: (name: string) => byName.get(name) ?? null,
    order: () => [...providers],
    has: (name: string) => byName.has(name),
    names: () => providers.map((p) => p.name),
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(tmpBase);
  tmpArtwork = await fs.mkdtemp(join(os.tmpdir(), 'kr8bit-art-'));
  await prisma.providerMatch.deleteMany({});
  await prisma.game.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createGame(opts: { entryName?: string; status?: MatchStatus; steamAppId?: number | null } = {}):
  Promise<string> {
  const game = await libraryRepository.create({
    entryPath: join(tmpDir, opts.entryName ?? 'Whatever.7z'),
    entryType: 'ARCHIVE',
    entryName: opts.entryName ?? 'Whatever.7z',
    sizeBytes: 100,
    matchStatus: opts.status ?? MatchStatus.PENDING,
  });
  if (opts.steamAppId !== undefined) {
    await libraryRepository.update(game.id, { steamAppId: opts.steamAppId, matchScore: 50 });
  }
  return game.id;
}

describe('MetadataService.searchForGame', () => {
  it('delegates to provider in registry order', async () => {
    const gameId = await createGame();
    const provider = mockProvider(
      'steam',
      [{ providerName: 'steam', remoteId: '620', title: 'Portal 2', score: 90 }],
      {},
    );
    const service = new MetadataService({
      providers: mockRegistry([provider]),
      artwork: mockArtwork(),
      now: () => new Date(),
    });

    const result = await service.searchForGame(gameId, 'portal');

    expect(result.gameId).toBe(gameId);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].remoteId).toBe('620');
    expect(result.results[0].providerName).toBe('steam');
    expect(provider.search).toHaveBeenCalledWith('portal');
  });

  it('merges results from multiple providers in order', async () => {
    const gameId = await createGame();
    const steam = mockProvider(
      'steam',
      [{ providerName: 'steam', remoteId: '620', title: 'Portal 2', score: 90 }],
      {},
    );
    const igdb = mockProvider(
      'igdb',
      [{ providerName: 'igdb', remoteId: '7', title: 'Portal 2', score: 80 }],
      {},
    );
    const service = new MetadataService({
      providers: mockRegistry([steam, igdb]),
      artwork: mockArtwork(),
      now: () => new Date(),
    });

    const result = await service.searchForGame(gameId, 'portal');

    expect(result.results).toHaveLength(2);
    expect(result.results[0].providerName).toBe('steam');
    expect(result.results[1].providerName).toBe('igdb');
  });

  it('scopes to a single provider when providerName specified', async () => {
    const gameId = await createGame();
    const steam = mockProvider(
      'steam',
      [{ providerName: 'steam', remoteId: '620', title: 'Portal 2' }],
      {},
    );
    const igdb = mockProvider(
      'igdb',
      [{ providerName: 'igdb', remoteId: '7', title: 'Portal 2' }],
      {},
    );
    const service = new MetadataService({
      providers: mockRegistry([steam, igdb]),
      artwork: mockArtwork(),
      now: () => new Date(),
    });

    const result = await service.searchForGame(gameId, 'portal', 'igdb');

    expect(result.results).toHaveLength(1);
    expect(result.results[0].providerName).toBe('igdb');
    expect(steam.search).not.toHaveBeenCalled();
  });

  it('throws ValidationError when scoping to unknown provider', async () => {
    const gameId = await createGame();
    const service = new MetadataService({
      providers: mockRegistry([]),
      artwork: mockArtwork(),
      now: () => new Date(),
    });
    expect.assertions(1);
    try {
      await service.searchForGame(gameId, 'portal', 'nope');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
  });

  it('returns empty results for empty query', async () => {
    const gameId = await createGame();
    const provider = mockProvider('steam', [{ providerName: 'steam', remoteId: '1', title: 'X', score: 95 }], {});
    const service = new MetadataService({
      providers: mockRegistry([provider]),
      artwork: mockArtwork(),
      now: () => new Date(),
    });

    const result = await service.searchForGame(gameId, '   ');

    expect(result.results).toEqual([]);
  });
});

describe('MetadataService.assign (steam)', () => {
  it('pulls metadata, downloads artwork via steam path, updates Game to MANUAL and leaves no ProviderMatch', async () => {
    const gameId = await createGame();
    const provider = mockProvider('steam', [], {
      '620': {
        remoteId: '620',
        title: 'Portal 2',
        releaseYear: 2011,
        description: 'A puzzle game.',
        developers: ['Valve'],
        publishers: ['Valve'],
        genres: ['Action', 'Puzzle'],
        coverUrl: 'https://x/cover.jpg',
        headerUrl: 'https://x/header.jpg',
      },
    });
    const artwork = mockArtwork();
    const service = new MetadataService({
      providers: mockRegistry([provider]),
      artwork,
      now: () => new Date('2024-06-01T00:00:00Z'),
    });

    const assigned = await service.assign(gameId, 'steam', '620');

    expect(assigned.game.title).toBe('Portal 2');
    expect(assigned.game.steamAppId).toBe(620);
    expect(assigned.game.matchStatus).toBe(MatchStatus.MANUAL);
    expect(assigned.game.matchScore).toBe(100);
    expect(assigned.game.matchedAt).toEqual(new Date('2024-06-01T00:00:00Z'));
    expect(assigned.game.genres).toEqual(['Action', 'Puzzle']);
    expect(assigned.game.coverUrl).toBe('https://x/cover.jpg');
    expect(assigned.fetchedArtwork.header).toBe(true);
    expect(assigned.fetchedArtwork.cover).toBe(true);
    expect(assigned.providerName).toBe('steam');

    expect(artwork.downloadToCache).toHaveBeenCalledTimes(2);
    expect(artwork.downloadToCacheGeneric).not.toHaveBeenCalled();

    expect(await providerMatchRepository.findByGame(gameId)).toEqual([]);
  });

  it('throws NotFoundError when remote id missing', async () => {
    const gameId = await createGame();
    const provider = mockProvider('steam', [], {});
    const service = new MetadataService({
      providers: mockRegistry([provider]),
      artwork: mockArtwork(),
      now: () => new Date(),
    });

    expect.assertions(1);
    try {
      await service.assign(gameId, 'steam', '999');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it('throws ValidationError when provider unknown', async () => {
    const gameId = await createGame();
    const service = new MetadataService({
      providers: mockRegistry([]),
      artwork: mockArtwork(),
      now: () => new Date(),
    });
    expect.assertions(1);
    try {
      await service.assign(gameId, 'nope', '1');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
  });

  it('continues assignment even when artwork download fails', async () => {
    const gameId = await createGame();
    const provider = mockProvider('steam', [], {
      '7': {
        remoteId: '7',
        title: 'Game',
        developers: [],
        publishers: [],
        genres: [],
        coverUrl: 'https://x/cover.jpg',
        headerUrl: 'https://x/header.jpg',
      },
    });
    const failingArtwork = { ...mockArtwork() };
    (failingArtwork.downloadToCache as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const service = new MetadataService({
      providers: mockRegistry([provider]),
      artwork: failingArtwork,
      now: () => new Date(),
    });

    const result = await service.assign(gameId, 'steam', '7');

    expect(result.fetchedArtwork.header).toBe(false);
    expect(result.fetchedArtwork.cover).toBe(false);
    expect(result.game.title).toBe('Game');
  });

  it('throws when game does not exist', async () => {
    const provider = mockProvider('steam', [], {
      '7': { remoteId: '7', title: 'X', developers: [], publishers: [], genres: [] },
    });
    const service = new MetadataService({
      providers: mockRegistry([provider]),
      artwork: mockArtwork(),
      now: () => new Date(),
    });
    expect.assertions(1);
    try {
      await service.assign('nonexistent', 'steam', '7');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });
});

describe('MetadataService.assign (igdb)', () => {
  it('uses generic artwork path, clears steamAppId, writes a primary ProviderMatch row', async () => {
    const gameId = await createGame({ steamAppId: 620 });
    const igdb = mockProvider('igdb', [], {
      '1234': {
        remoteId: '1234',
        title: 'Portal 2',
        releaseYear: 2011,
        developers: ['Valve'],
        publishers: ['Valve'],
        genres: ['Puzzle'],
        coverUrl: 'https://x/igdb-cover.jpg',
        headerUrl: 'https://x/igdb-art.jpg',
      },
    });
    const artwork = mockArtwork();
    const service = new MetadataService({
      providers: mockRegistry([mockProvider('steam', [], {}), igdb]),
      artwork,
      now: () => new Date('2024-07-01T00:00:00Z'),
    });

    const assigned = await service.assign(gameId, 'igdb', '1234');

    expect(assigned.providerName).toBe('igdb');
    expect(assigned.game.steamAppId).toBeNull();
    expect(assigned.game.title).toBe('Portal 2');
    expect(assigned.game.coverUrl).toBe('https://x/igdb-cover.jpg');
    expect(assigned.game.matchStatus).toBe(MatchStatus.MANUAL);
    expect(assigned.game.matchScore).toBe(100);
    expect(assigned.fetchedArtwork).toEqual({ header: true, cover: true });

    expect(artwork.downloadToCache).not.toHaveBeenCalled();
    expect(artwork.downloadToCacheGeneric).toHaveBeenCalledTimes(2);
    expect(artwork.downloadToCacheGeneric).toHaveBeenCalledWith(
      'igdb',
      '1234',
      'header',
      'https://x/igdb-art.jpg',
    );
    expect(artwork.downloadToCacheGeneric).toHaveBeenCalledWith(
      'igdb',
      '1234',
      'cover',
      'https://x/igdb-cover.jpg',
    );

    const primary = await providerMatchRepository.findPrimaryByGame(gameId);
    expect(primary?.providerName).toBe('igdb');
    expect(primary?.remoteId).toBe('1234');
    expect(primary?.isPrimary).toBe(true);
    expect(primary?.matchedAt).toEqual(new Date('2024-07-01T00:00:00Z'));
  });
});

describe('MetadataService.refresh', () => {
  it('refreshes metadata via primary ProviderMatch when present (igdb)', async () => {
    const gameId = await createGame({ steamAppId: null });
    await libraryRepository.update(gameId, {
      title: 'Old Title',
      matchStatus: MatchStatus.MANUAL,
      matchScore: 100,
      matchedAt: new Date('2024-01-01'),
    });
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '1234',
      matchScore: 80,
      isPrimary: true,
      matchedAt: new Date('2024-01-01'),
    });
    const igdb = mockProvider('igdb', [], {
      '1234': {
        remoteId: '1234',
        title: 'Portal 2 Refreshed',
        releaseYear: 2011,
        developers: ['Valve'],
        publishers: ['Valve'],
        genres: ['Puzzle'],
        coverUrl: 'https://x/c.jpg',
        headerUrl: 'https://x/h.jpg',
      },
    });
    const steam = mockProvider('steam', [], {});
    const artwork = mockArtwork();
    const service = new MetadataService({
      providers: mockRegistry([steam, igdb]),
      artwork,
      now: () => new Date('2024-07-10T00:00:00Z'),
    });

    const game = await service.refresh(gameId);

    expect(game).not.toBeNull();
    expect(game!.title).toBe('Portal 2 Refreshed');
    expect(game!.genres).toEqual(['Puzzle']);
    expect(game!.matchedAt).toEqual(new Date('2024-07-10T00:00:00Z'));
    expect(igdb.getGame).toHaveBeenCalledWith('1234');
    expect(steam.getGame).not.toHaveBeenCalled();
    expect(artwork.downloadToCacheGeneric).toHaveBeenCalledTimes(2);
    expect(artwork.downloadToCache).not.toHaveBeenCalled();
  });

  it('refreshes via steam fallback when no ProviderMatch and steamAppId present', async () => {
    const gameId = await createGame({ steamAppId: 620, status: MatchStatus.MANUAL });
    const steam = mockProvider('steam', [], {
      '620': {
        remoteId: '620',
        title: 'Portal 2 Updated',
        releaseYear: 2011,
        developers: ['Valve'],
        publishers: ['Valve'],
        genres: ['Puzzle'],
        coverUrl: 'https://x/cover.jpg',
        headerUrl: 'https://x/header.jpg',
      },
    });
    const service = new MetadataService({
      providers: mockRegistry([steam]),
      artwork: mockArtwork(),
      now: () => new Date('2024-06-10T00:00:00Z'),
    });

    const game = await service.refresh(gameId);

    expect(game).not.toBeNull();
    expect(game!.title).toBe('Portal 2 Updated');
    expect(game!.genres).toEqual(['Puzzle']);
    expect(game!.matchedAt).toEqual(new Date('2024-06-10T00:00:00Z'));
    expect(game!.matchStatus).toBe(MatchStatus.MANUAL);
  });

  it('returns null when game has no steamAppId and no ProviderMatch', async () => {
    const gameId = await createGame({ steamAppId: null });
    const service = new MetadataService({
      providers: mockRegistry([mockProvider('steam', [], {})]),
      artwork: mockArtwork(),
      now: () => new Date(),
    });
    expect(await service.refresh(gameId)).toBeNull();
  });

  it('returns null when primary provider no longer has data', async () => {
    const gameId = await createGame({ steamAppId: null });
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '999',
      matchScore: 80,
      isPrimary: true,
      matchedAt: new Date(),
    });
    const igdb = mockProvider('igdb', [], {});
    const service = new MetadataService({
      providers: mockRegistry([mockProvider('steam', [], {}), igdb]),
      artwork: mockArtwork(),
      now: () => new Date(),
    });
    expect(await service.refresh(gameId)).toBeNull();
  });
});

describe('MetadataService.unlink', () => {
  it('clears metadata, resets to PENDING, prunes steam artwork when no ProviderMatch', async () => {
    const gameId = await createGame({ steamAppId: 7 });
    await libraryRepository.update(gameId, {
      title: 'Game With Meta',
      developers: ['Dev'],
      publishers: ['Pub'],
      genres: ['Action'],
      coverUrl: 'https://x/cover.jpg',
      headerUrl: 'https://x/header.jpg',
      matchStatus: MatchStatus.MANUAL,
      matchScore: 100,
      matchedAt: new Date(),
    });

    const artwork = mockArtwork();
    const service = new MetadataService({
      providers: mockRegistry([mockProvider('steam', [], {})]),
      artwork,
      now: () => new Date(),
    });

    const game = await service.unlink(gameId);

    expect(game.steamAppId).toBeNull();
    expect(game.title).toBeNull();
    expect(game.genres).toEqual([]);
    expect(game.coverUrl).toBeNull();
    expect(game.headerUrl).toBeNull();
    expect(game.matchStatus).toBe(MatchStatus.PENDING);
    expect(game.matchScore).toBeNull();
    expect(game.matchedAt).toBeNull();
    expect(artwork.remove).toHaveBeenCalledWith(7);
    expect(artwork.removeGeneric).not.toHaveBeenCalled();
  });

  it('prunes generic artwork and clears ProviderMatch rows when primary ProviderMatch present', async () => {
    const gameId = await createGame({ steamAppId: null });
    await libraryRepository.update(gameId, {
      title: 'IGDB Game',
      matchStatus: MatchStatus.MANUAL,
      matchScore: 100,
      matchedAt: new Date(),
      coverUrl: 'https://x/c.jpg',
      headerUrl: 'https://x/h.jpg',
    });
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '1234',
      matchScore: 80,
      isPrimary: true,
      matchedAt: new Date(),
    });

    const artwork = mockArtwork();
    const service = new MetadataService({
      providers: mockRegistry([mockProvider('steam', [], {}), mockProvider('igdb', [], {})]),
      artwork,
      now: () => new Date(),
    });

    const game = await service.unlink(gameId);

    expect(game.steamAppId).toBeNull();
    expect(game.title).toBeNull();
    expect(game.matchStatus).toBe(MatchStatus.PENDING);
    expect(artwork.removeGeneric).toHaveBeenCalledWith('igdb', '1234');
    expect(artwork.remove).not.toHaveBeenCalled();
    expect(await providerMatchRepository.findByGame(gameId)).toEqual([]);
  });
});