import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/http/server.js';
import { prisma } from '../src/prisma-client.js';

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