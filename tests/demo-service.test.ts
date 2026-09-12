import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { demoService } from '../src/modules/demo/demo-service.js';
import { DEMO_GAMES } from '../src/modules/demo/demo-data.js';

beforeEach(async () => {
  await demoService.resetAndSeed();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('demoService', () => {
  it('resets and seeds deterministic library data', async () => {
    const games = await prisma.game.findMany({ orderBy: { id: 'asc' } });

    expect(games).toHaveLength(DEMO_GAMES.length);
    expect(games.map((game) => game.id)).toEqual(DEMO_GAMES.map((game) => game.id));
    expect(games.every((game) => game.coverUrl === null)).toBe(true);
  });

  it('reports demo status without exposing a mutation', () => {
    expect(demoService.status()).toEqual({ enabled: false, offline: false });
  });
});
