import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../src/prisma-client.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { MetadataService } from '../src/modules/metadata/metadata.service.js';
import { MatchStatus } from '../src/shared/enums.js';
import { NotFoundError } from '../src/shared/errors.js';
import type { ArtworkService } from '../src/modules/artwork/artwork.service.js';
import type {
  GameMetadata,
  ImageSet,
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
  } as unknown as ArtworkService;
}

function mockProvider(
  searchResults: SearchResult[],
  metadataByRemoteId: Record<string, GameMetadata>,
  imagesByRemoteId: Record<string, ImageSet> = {},
): MetadataProvider {
  return {
    name: 'mock',
    search: vi.fn(async () => searchResults),
    getGame: vi.fn(async (id: string) => metadataByRemoteId[id] ?? null),
    getImages: vi.fn(async (id: string) => imagesByRemoteId[id] ?? {}),
  } as unknown as MetadataProvider;
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(tmpBase);
  tmpArtwork = await fs.mkdtemp(join(os.tmpdir(), 'kr8bit-art-'));
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
  it('delegates to provider', async () => {
    const gameId = await createGame();
    const provider = mockProvider(
      [{ remoteId: '620', title: 'Portal 2', score: 90 }],
      {},
    );
    const service = new MetadataService({ provider, artwork: mockArtwork(), now: () => new Date() });

    const result = await service.searchForGame(gameId, 'portal');

    expect(result.gameId).toBe(gameId);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].remoteId).toBe('620');
    expect(provider.search).toHaveBeenCalledWith('portal');
  });

  it('returns empty results for empty query', async () => {
    const gameId = await createGame();
    const provider = mockProvider([{ remoteId: '1', title: 'X', score: 95 }], {});
    const service = new MetadataService({ provider, artwork: mockArtwork(), now: () => new Date() });

    const result = await service.searchForGame(gameId, '   ');

    expect(result.results).toEqual([]);
  });
});

describe('MetadataService.assign', () => {
  it('pulls metadata, downloads artwork, updates Game to MANUAL', async () => {
    const gameId = await createGame();
    const provider = mockProvider([], {
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
    const service = new MetadataService({ provider, artwork, now: () => new Date('2024-06-01T00:00:00Z') });

    const assigned = await service.assign(gameId, '620');

    expect(assigned.game.title).toBe('Portal 2');
    expect(assigned.game.steamAppId).toBe(620);
    expect(assigned.game.matchStatus).toBe(MatchStatus.MANUAL);
    expect(assigned.game.matchScore).toBe(100);
    expect(assigned.game.matchedAt).toEqual(new Date('2024-06-01T00:00:00Z'));
    expect(assigned.game.genres).toEqual(['Action', 'Puzzle']);
    expect(assigned.game.coverUrl).toBe('https://x/cover.jpg');
    expect(assigned.fetchedArtwork.header).toBe(true);
    expect(assigned.fetchedArtwork.cover).toBe(true);

    expect(artwork.downloadToCache).toHaveBeenCalledTimes(2);
  });

  it('throws NotFoundError when remote id missing', async () => {
    const gameId = await createGame();
    const provider = mockProvider([], {});
    const service = new MetadataService({ provider, artwork: mockArtwork(), now: () => new Date() });

    expect.assertions(1);
    try {
      await service.assign(gameId, '999');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it('continues assignment even when artwork download fails', async () => {
    const gameId = await createGame();
    const provider = mockProvider([], {
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
    const service = new MetadataService({ provider, artwork: failingArtwork, now: () => new Date() });

    const result = await service.assign(gameId, '7');

    expect(result.fetchedArtwork.header).toBe(false);
    expect(result.fetchedArtwork.cover).toBe(false);
    expect(result.game.title).toBe('Game');
  });

  it('throws when game does not exist', async () => {
    const provider = mockProvider([], { '7': { remoteId: '7', title: 'X', developers: [], publishers: [], genres: [] } });
    const service = new MetadataService({ provider, artwork: mockArtwork(), now: () => new Date() });
    expect.assertions(1);
    try {
      await service.assign('nonexistent', '7');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });
});

describe('MetadataService.refresh', () => {
  it('refreshes metadata for a game with steamAppId and preserves non-PENDING status', async () => {
    const gameId = await createGame({ steamAppId: 620, status: MatchStatus.MANUAL });
    const provider = mockProvider([], {
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
    const service = new MetadataService({ provider, artwork: mockArtwork(), now: () => new Date('2024-06-10T00:00:00Z') });

    const game = await service.refresh(gameId);

    expect(game).not.toBeNull();
    expect(game!.title).toBe('Portal 2 Updated');
    expect(game!.genres).toEqual(['Puzzle']);
    expect(game!.matchedAt).toEqual(new Date('2024-06-10T00:00:00Z'));
    expect(game!.matchStatus).toBe(MatchStatus.MANUAL);
  });

  it('returns null when game has no steamAppId', async () => {
    const gameId = await createGame({ steamAppId: null });
    const service = new MetadataService({
      provider: mockProvider([], {}),
      artwork: mockArtwork(),
      now: () => new Date(),
    });
    expect(await service.refresh(gameId)).toBeNull();
  });

  it('returns null when provider has no data', async () => {
    const gameId = await createGame({ steamAppId: 999 });
    const provider = mockProvider([], {});
    const service = new MetadataService({ provider, artwork: mockArtwork(), now: () => new Date() });
    expect(await service.refresh(gameId)).toBeNull();
  });
});

describe('MetadataService.unlink', () => {
  it('clears metadata and resets to PENDING, prunes cached artwork', async () => {
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
    const service = new MetadataService({ provider: mockProvider([], {}), artwork, now: () => new Date() });

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
  });
});