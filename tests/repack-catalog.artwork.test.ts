import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtworkService, type ArtworkClient } from '../src/modules/artwork/artwork.service.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import type { Game } from '../src/modules/library/library.types.js';
import { prisma } from '../src/prisma-client.js';
import { RepackCatalogService, type RepackCatalogServiceDependencies } from '../src/modules/repack-catalog/repack-catalog.service.js';
import type { SteamGridDbHttpClient } from '../src/modules/artwork/steamgriddb/steamgriddb.http.js';
import type { SteamGridDbGame, SteamGridDbImage } from '../src/modules/artwork/steamgriddb/steamgriddb.http.types.js';
import { createRepackCatalogRoutes } from '../src/http/routes/repack-catalog.routes.js';
import type { RepackCatalogJob } from '../src/modules/repack-catalog/repack-catalog.job.js';

const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

const snapshot = {
  remoteId: 'snapshot-id', title: 'Example Game', developers: [], publishers: [], genres: [],
  coverUrl: 'https://art.test/snapshot.png',
};

const libraryGame = {
  id: 'library-id', steamAppId: null, title: 'Example Game', entryName: 'Example Game',
  coverUrl: 'https://art.test/library.png',
} as Game;

function createService(options: {
  game?: {
    providerName: string | null;
    providerRemoteId?: string | null;
    title?: string;
    normalizedTitle: string;
    metadataSnapshot: typeof snapshot | null;
    matchCandidates: Array<{ providerName: string; remoteId: string; title: string; coverUrl?: string; score: number }>;
  } | null;
  library?: Game | null;
}, steamGridDb: RepackCatalogServiceDependencies['steamGridDb'] = null): RepackCatalogService {
  const game = options.game === undefined ? {
    providerName: 'igdb', providerRemoteId: 'snapshot-id', title: 'Example Game', normalizedTitle: 'example game',
    metadataSnapshot: snapshot, matchCandidates: [],
  } : options.game;
  const repository = {
    getArtworkGame: vi.fn().mockResolvedValue(game && {
      providerRemoteId: null, title: 'Example Game', ...game,
    }),
  } as unknown as RepackCatalogServiceDependencies['repackCatalogRepository'];
  const settingsRepository = { get: vi.fn(), set: vi.fn(), setMany: vi.fn(), list: vi.fn(), delete: vi.fn() };
  return new RepackCatalogService({
    repackCatalogRepository: repository,
    settingsRepository: settingsRepository as unknown as RepackCatalogServiceDependencies['settingsRepository'],
    providerRegistry: { order: () => [], resolve: () => null, has: () => false, names: () => [] },
    sourceFactory: () => { throw new Error('unused'); },
    matchThresholds: { acceptThreshold: 85, flagThreshold: 70 },
    regroupGames: vi.fn(),
    libraryRepository: { findByNormalizedTitle: vi.fn().mockResolvedValue(options.library === undefined ? libraryGame : options.library) },
    providerMatchRepository: { findPrimaryByGame: vi.fn().mockResolvedValue({ providerName: 'igdb', remoteId: 'library-remote' }) },
    steamGridDb,
  });
}

function createArtworkService(requested: string[], failures: Set<string>, cacheDir: string): ArtworkService {
  const client: ArtworkClient = {
    async download(url) {
      requested.push(url);
      if (failures.has(url)) throw new Error('not found');
      return imageBytes;
    },
  };
  return new ArtworkService(cacheDir, client, { now: () => new Date(), cacheTtlMs: 60_000 });
}

describe('repack catalog artwork fallback', () => {
  let app: FastifyInstance | undefined;
  let cacheDir: string | undefined;

  afterEach(async () => {
    if (app) await app.close();
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
    app = undefined;
    cacheDir = undefined;
  });

  it('orders snapshot, normalized-title library, then best cover candidate', async () => {
    const service = createService({
      game: {
        providerName: 'igdb', normalizedTitle: 'example game', metadataSnapshot: snapshot,
        matchCandidates: [
          { providerName: 'steam', remoteId: 'lower', title: 'Lower', coverUrl: 'https://art.test/lower.png', score: 70 },
          { providerName: 'steam', remoteId: 'best', title: 'Best', coverUrl: 'https://art.test/best.png', score: 90 },
        ],
      },
    });
    const sources = await service.getArtworkSources('repack-id', 'cover');
    expect(sources.map((source) => source.url)).toEqual([
      'https://art.test/snapshot.png', 'https://art.test/library.png', 'https://art.test/best.png',
    ]);
  });

  it('uses the library cover after snapshot download fails', async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'kr8bit-artwork-'));
    const requested: string[] = [];
    const service = createService({});
    app = Fastify();
    await app.register(createRepackCatalogRoutes(
      service,
      {} as RepackCatalogJob,
      createArtworkService(requested, new Set(['https://art.test/snapshot.png']), cacheDir),
    ));

    const response = await app.inject({ method: 'GET', url: '/api/repack-catalog/repack-id/artwork/cover' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(requested).toEqual(['https://art.test/snapshot.png', 'https://art.test/library.png']);
  });

  it('serves best candidate cover when no matched library artwork exists', async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'kr8bit-artwork-'));
    const requested: string[] = [];
    const service = createService({
      game: {
        providerName: null, normalizedTitle: 'example game', metadataSnapshot: null,
        matchCandidates: [{
          providerName: 'steam', remoteId: 'candidate-id', title: 'Example Game',
          coverUrl: 'https://art.test/candidate.png', score: 80,
        }],
      },
      library: null,
    });
    app = Fastify();
    await app.register(createRepackCatalogRoutes(
      service,
      {} as RepackCatalogJob,
      createArtworkService(requested, new Set(), cacheDir),
    ));

    const response = await app.inject({ method: 'GET', url: '/api/repack-catalog/repack-id/artwork/cover' });
    expect(response.statusCode).toBe(200);
    expect(requested).toEqual(['https://art.test/candidate.png']);
  });

  it('omits candidate artwork for non-cover kinds', async () => {
    const service = createService({
      game: {
        providerName: null, normalizedTitle: 'example game', metadataSnapshot: null,
        matchCandidates: [{ providerName: 'steam', remoteId: '1', title: 'Example', coverUrl: 'https://art.test/candidate.png', score: 80 }],
      },
      library: null,
    });
    expect(await service.getArtworkSources('repack-id', 'header')).toEqual([]);
  });

  it('excludes zero-score candidates from cover fallback', async () => {
    const service = createService({
      game: {
        providerName: null, title: 'Example Game', normalizedTitle: 'example game', metadataSnapshot: null,
        matchCandidates: [{ providerName: 'steam', remoteId: '1', title: 'Wrong Game', coverUrl: 'https://art.test/wrong.png', score: 0 }],
      },
      library: null,
    });
    expect(await service.getArtworkSources('repack-id', 'cover')).toEqual([]);
  });

  it('resolves a lazy SteamGridDB grid source for unowned pending games', async () => {
    const sgdbGame: SteamGridDbGame = { id: 7, name: 'Example Game', verified: true };
    const grid: SteamGridDbImage = {
      id: 88, score: 10, style: 'alternate', url: 'https://art.test/sgdb.png', thumb: '', tags: [],
      author: { name: '', steam64: '', avatar: '' }, language: 'en', notes: null,
      width: 600, height: 900, upvotes: 0, downvotes: 0,
    };
    const client: SteamGridDbHttpClient = {
      searchGameByName: vi.fn().mockResolvedValue([sgdbGame]),
      getGridsBySteamAppId: vi.fn().mockResolvedValue([]),
      getHeroesBySteamAppId: vi.fn().mockResolvedValue([]),
      getLogosBySteamAppId: vi.fn().mockResolvedValue([]),
      getGridsByGameId: vi.fn().mockResolvedValue([grid]),
      getHeroesByGameId: vi.fn().mockResolvedValue([]),
    };
    const service = createService({
      game: { providerName: null, title: 'Example Game', normalizedTitle: 'example game', metadataSnapshot: null, matchCandidates: [] },
      library: null,
    }, client);

    expect(await service.getSteamGridDbArtworkSource('repack-id', 'cover')).toEqual({
      providerName: 'steamgriddb', remoteId: '88', url: 'https://art.test/sgdb.png',
    });
  });

  it('redirects to first URL only after every source download fails', async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'kr8bit-artwork-'));
    const requested: string[] = [];
    const service = createService({});
    app = Fastify();
    await app.register(createRepackCatalogRoutes(
      service,
      {} as RepackCatalogJob,
      createArtworkService(requested, new Set(['https://art.test/snapshot.png', 'https://art.test/library.png']), cacheDir),
    ));

    const response = await app.inject({ method: 'GET', url: '/api/repack-catalog/repack-id/artwork/cover' });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('https://art.test/snapshot.png');
  });

  it('returns 404 when no artwork source exists', async () => {
    const service = createService({
      game: { providerName: null, normalizedTitle: 'example game', metadataSnapshot: null, matchCandidates: [] },
      library: null,
    });
    app = Fastify();
    await app.register(createRepackCatalogRoutes(service, {} as RepackCatalogJob));

    const response = await app.inject({ method: 'GET', url: '/api/repack-catalog/repack-id/artwork/cover' });
    expect(response.statusCode).toBe(404);
  });

  it('finds library artwork by normalized metadata title', async () => {
    const id = randomUUID();
    const entryPath = `/repack-artwork-test/${id}`;
    const title = `Artwork Probe ${id}`;
    const inserted = await prisma.game.create({
      data: {
        entryPath, entryType: 'ARCHIVE', entryName: `${title} (v1.2)`, title,
        sizeBytes: BigInt(1), matchStatus: 'ACCEPTED', developers: '[]', publishers: '[]', genres: '[]',
        screenshots: '[]', videos: '[]', steamDeckItems: '[]', coverUrl: 'https://art.test/library.png',
      },
    });
    try {
      const result = await libraryRepository.findByNormalizedTitle(title.toLowerCase(), 'cover');
      expect(result?.id).toBe(inserted.id);
    } finally {
      await prisma.game.delete({ where: { entryPath } });
    }
  });
});
