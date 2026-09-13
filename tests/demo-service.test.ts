import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { config } from '../src/config/index.js';
import { demoService } from '../src/modules/demo/demo-service.js';
import { DEMO_GAMES } from '../src/modules/demo/demo-data.js';

beforeEach(async () => {
  await demoService.resetAndSeed({
    name: 'steam',
    search: vi.fn(),
    getGame: vi.fn(async (remoteId: string) => ({
      remoteId,
      title: `Demo ${remoteId}`,
      releaseYear: 2020,
      description: 'Demo description',
      developers: ['Demo Studio'],
      publishers: ['Demo Publisher'],
      genres: ['Action'],
      coverUrl: `https://example.test/${remoteId}/cover.jpg`,
      headerUrl: `https://example.test/${remoteId}/header.jpg`,
      videos: [{ url: `https://example.test/${remoteId}/video.mp4`, thumbnailUrl: '' }],
    })),
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('demoService', () => {
  it('resets and seeds deterministic library data', async () => {
    const games = await prisma.game.findMany({ orderBy: { id: 'asc' } });

    const expectedGames = DEMO_GAMES.slice(0, config.demoGameCount);
    expect(games).toHaveLength(expectedGames.length);
    expect(games.map((game) => game.id).sort()).toEqual(expectedGames.map((game) => game.id).sort());
    expect(games.every((game) => game.coverUrl?.startsWith('https://example.test/'))).toBe(true);
    expect(games.every((game) => game.videos !== '[]')).toBe(true);
  });

  it('reports demo status without exposing a mutation', () => {
    expect(demoService.status()).toEqual({ enabled: false, offline: false });
  });

  it('keeps demo database URL separate from normal database URL', () => {
    expect(config.demoDatabaseUrl).not.toBe(config.databaseUrl);
  });

  it('removes legacy demo rows without removing real games', async () => {
    await prisma.game.create({
      data: {
        entryPath: '/games/real.7z',
        entryType: 'ARCHIVE',
        entryName: 'real.7z',
        sizeBytes: 1,
        developers: '[]',
        publishers: '[]',
        genres: '[]',
        screenshots: '[]',
        videos: '[]',
        steamDeckItems: '[]',
        matchStatus: 'PENDING',
      },
    });

    await demoService.removeLegacyData();

    expect(await prisma.game.findUnique({ where: { entryPath: '/games/real.7z' } })).not.toBeNull();
    expect(await prisma.game.findMany({ where: { entryPath: { startsWith: '/demo/library/' } } })).toHaveLength(0);
  });
});
