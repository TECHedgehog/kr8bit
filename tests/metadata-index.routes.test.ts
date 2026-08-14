import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/http/server.js';
import { prisma } from '../src/prisma-client.js';
import { steamIndexService } from '../src/modules/metadata/steam-index/steam-index.service.js';

let app: FastifyInstance;

beforeEach(async () => {
  await prisma.steamAppIndex.deleteMany({});
  await prisma.setting.deleteMany({ where: { key: 'steamIndexLastRefresh' } });
  await prisma.game.deleteMany({});
  await prisma.scanRun.deleteMany({});
  app = await buildServer();
});

afterEach(async () => {
  if (app) await app.close();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/metadata/search-steam', () => {
  it('returns empty results array when q missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metadata/search-steam' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ results: [] });
  });

  it('returns empty results array when q blank', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metadata/search-steam?q=%20' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ results: [] });
  });

  it('returns empty results when index not built', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metadata/search-steam?q=Skyrim' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ results: [] });
  });
});

describe('GET /api/metadata/search-steam with indexed data', () => {
  beforeEach(async () => {
    await prisma.steamAppIndex.createMany({
      data: [
        { appId: 72850, name: 'The Elder Scrolls V: Skyrim', indexedAt: new Date() },
        { appId: 489830, name: 'The Elder Scrolls V: Skyrim Special Edition', indexedAt: new Date() },
        { appId: 1746860, name: 'The Elder Scrolls V: Skyrim Anniversary Upgrade', indexedAt: new Date() },
        { appId: 620, name: 'Portal 2', indexedAt: new Date() },
        { appId: 570, name: "Counter-Strike: Global Offensive", indexedAt: new Date() },
      ],
    });
    await steamIndexService.rebuildIndex();
  });

  it('returns matching results for a known game', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metadata/search-steam?q=Skyrim' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.length).toBeLessThanOrEqual(20);
    for (const r of body.results) {
      expect(r.name.toLowerCase()).toContain('skyrim');
      expect(r.appId).toBeTypeOf('number');
      expect(r.score).toBeTypeOf('number');
    }
  });

  it('returns results for partial match', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metadata/search-steam?q=Portal' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0].name).toContain('Portal');
  });

  it('returns empty results for no match', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metadata/search-steam?q=ZZZZZZZ' });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toEqual([]);
  });

  it('limits results to 20', async () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({
      appId: 100000 + i,
      name: `Skyrim Variant ${i}`,
      indexedAt: new Date(),
    }));
    await prisma.steamAppIndex.createMany({ data: entries });
    await steamIndexService.rebuildIndex();

    const res = await app.inject({ method: 'GET', url: '/api/metadata/search-steam?q=Skyrim' });
    expect(res.statusCode).toBe(200);
    expect(res.json().results.length).toBeLessThanOrEqual(20);
  });
});
