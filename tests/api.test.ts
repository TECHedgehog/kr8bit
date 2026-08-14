import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { buildServer } from '../src/http/server.js';
import { config } from '../src/config/index.js';
import { prisma } from '../src/prisma-client.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { scannerService } from '../src/modules/scanner/scanner.service.js';
import { MatchStatus } from '../src/shared/enums.js';
import type { FastifyInstance } from 'fastify';

const tmpBase = join(os.tmpdir(), 'kr8bit-api-');
let tmpDir: string;
let app: FastifyInstance;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(tmpBase);
  await prisma.game.deleteMany({});
  await prisma.scanRun.deleteMany({});
  await prisma.setting.deleteMany({});
  app = await buildServer();
});

afterEach(async () => {
  if (app) await app.close();
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
    sizeBytes: 1,
    matchStatus: opts.status ?? MatchStatus.PENDING,
  });
  if (opts.steamAppId !== undefined) {
    await libraryRepository.update(game.id, { steamAppId: opts.steamAppId });
  }
  return game.id;
}

describe('GET /api/health', () => {
  it('returns 200 ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
  });
});

describe('GET /api/settings', () => {
  it('returns env and empty kv', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.env).toBeDefined();
    expect(body.env.libraryRoot).toBeDefined();
    expect(body.kv).toEqual([]);
  });
});

describe('PUT /api/settings', () => {
  it('upserts kv pairs', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { foo: 'bar', greetings: 'world' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().updated).toBe(2);

    const list = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(list.json().kv).toEqual([
      { key: 'foo', value: 'bar' },
      { key: 'greetings', value: 'world' },
    ]);
  });

  it('rejects non-string values with 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { a: 1, b: 'ok' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns validation error envelope for non-string value', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { a: 1 },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/games', () => {
  it('returns paginated list', async () => {
    await createGame({ entryName: 'A.7z' });
    await createGame({ entryName: 'B.7z' });
    await createGame({ entryName: 'C.7z', status: MatchStatus.ACCEPTED });

    const res = await app.inject({ method: 'GET', url: '/api/games?limit=2' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(3);
  });

  it('filters by status', async () => {
    await createGame({ entryName: 'A.7z', status: MatchStatus.PENDING });
    await createGame({ entryName: 'B.7z', status: MatchStatus.ACCEPTED });

    const res = await app.inject({ method: 'GET', url: '/api/games?status=ACCEPTED' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].entryName).toBe('B.7z');
  });

  it('rejects invalid status filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/games?status=NOPE' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid limit', async () => {
    const zero = await app.inject({ method: 'GET', url: '/api/games?limit=0' });
    expect(zero.statusCode).toBe(400);
  });

  it('rejects invalid offset', async () => {
    const negative = await app.inject({ method: 'GET', url: '/api/games?offset=-1' });
    expect(negative.statusCode).toBe(400);
  });

  it('caps limit at 200', async () => {
    await createGame({ entryName: 'A.7z' });
    const res = await app.inject({ method: 'GET', url: '/api/games?limit=999' });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
  });
});

describe('GET/PATCH/DELETE /api/games/:id', () => {
  it('fetches by id', async () => {
    const id = await createGame({ entryName: 'Game.7z' });
    const res = await app.inject({ method: 'GET', url: `/api/games/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(id);
  });

  it('returns 404 when missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/games/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('patches title and arrays', async () => {
    const id = await createGame();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/games/${id}`,
      payload: { title: 'Custom Title', genres: ['RPG', 'Indie'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe('Custom Title');
    expect(body.genres).toEqual(['RPG', 'Indie']);
  });

  it('deletes game', async () => {
    const id = await createGame();
    const del = await app.inject({ method: 'DELETE', url: `/api/games/${id}` });
    expect(del.statusCode).toBe(200);
    expect(del.json().deleted).toBe(true);
    const after = await app.inject({ method: 'GET', url: `/api/games/${id}` });
    expect(after.statusCode).toBe(404);
  });
});

describe('Scanner endpoints', () => {
  it('GET /api/scanner/status with no runs', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/scanner/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.running).toBeNull();
    expect(body.latest).toBeNull();
    expect(body.isRunning).toBe(false);
  });

  it('returns 202 when scan starts', async () => {
    const startSpy = vi.spyOn(scannerService, 'start').mockResolvedValue({
      id: 'run-1',
      status: 'RUNNING',
      rootPath: '/games',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      errors: [],
    } as unknown as Awaited<ReturnType<typeof scannerService.start>>);

    const res = await app.inject({ method: 'POST', url: '/api/scanner/run' });

    expect(res.statusCode).toBe(202);
    expect(res.json().id).toBe('run-1');
    startSpy.mockRestore();
  });

  it('rejects run when scanner is already running', async () => {
    vi.spyOn(scannerService, 'isRunning').mockReturnValueOnce(true);

    const res = await app.inject({ method: 'POST', url: '/api/scanner/run' });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('SCAN_RUNNING');
  });
});

describe('Metadata endpoints', () => {
  it('POST /api/games/:id/metadata/search returns 200 with results array shape', async () => {
    const id = await createGame();
    const res = await app.inject({
      method: 'POST',
      url: `/api/games/${id}/metadata/search`,
      payload: { query: '' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.gameId).toBe(id);
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results).toEqual([]);
  });

  it('POST /api/games/:id/metadata/assign requires remoteId', async () => {
    const id = await createGame();
    const res = await app.inject({
      method: 'POST',
      url: `/api/games/${id}/metadata/assign`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/games/:id/metadata/assign throws 404 for bad remoteId', async () => {
    const id = await createGame();
    const res = await app.inject({
      method: 'POST',
      url: `/api/games/${id}/metadata/assign`,
      payload: { remoteId: '999' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /api/games/:id/metadata resets to PENDING', async () => {
    const id = await createGame({ steamAppId: 42 });
    await libraryRepository.update(id, {
      title: 'Game With Meta',
      matchStatus: MatchStatus.MANUAL,
      matchScore: 100,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/games/${id}/metadata`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.steamAppId).toBeNull();
    expect(body.title).toBeNull();
    expect(body.matchStatus).toBe(MatchStatus.PENDING);
  });
});

describe('Artwork endpoint', () => {
  it('rejects invalid kind', async () => {
    const id = await createGame({ steamAppId: 620 });
    const res = await app.inject({ method: 'GET', url: `/api/games/${id}/artwork/invalid` });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when game has no steamAppId', async () => {
    const id = await createGame();
    const res = await app.inject({ method: 'GET', url: `/api/games/${id}/artwork/header` });
    expect(res.statusCode).toBe(404);
  });

  it('redirects to remote header URL when no cache exists and DB has headerUrl', async () => {
    const id = await createGame({ steamAppId: 620 });
    await libraryRepository.update(id, {
      headerUrl: 'https://steamcdn.test/header.jpg',
      matchStatus: MatchStatus.ACCEPTED,
    });
    // Ensure no stale cache file from a previous run influences this test.
    await fs.rm(join(config.cacheDir, 'artwork', '620'), { recursive: true, force: true });

    const res = await app.inject({ method: 'GET', url: `/api/games/${id}/artwork/header` });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('https://steamcdn.test/header.jpg');
  });
});

describe('error envelope shape', () => {
  it('returns structured 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/games/nonexistent' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.statusCode).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
    expect(body.error).toBe('NotFoundError');
  });
});

describe('Database endpoints', () => {
  beforeEach(() => {
    vi.spyOn(scannerService, 'isRunning').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/database/reset requires confirmation', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/database/reset', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/database/reset returns counts after wipe', async () => {
    await createGame({ entryName: 'A.7z' });
    await prisma.setting.create({ data: { key: 'x', value: 'y' } });

    const res = await app.inject({
      method: 'POST',
      url: '/api/database/reset',
      payload: { confirm: 'RESET' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.games).toBe(1);
    expect(body.settings).toBe(1);
  });

  it('POST /api/database/reset returns 409 when scan running', async () => {
    vi.mocked(scannerService.isRunning).mockReturnValue(true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/database/reset',
      payload: { confirm: 'RESET' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('SCAN_RUNNING');
  });
});