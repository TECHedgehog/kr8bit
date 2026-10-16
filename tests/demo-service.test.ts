import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { config } from '../src/config/index.js';
import { demoService } from '../src/modules/demo/demo-service.js';
import { DEMO_GAMES } from '../src/modules/demo/demo-data.js';
import { scannerRepository } from '../src/modules/scanner/scanner.repository.js';
import { onProgress, type ScanProgressEvent } from '../src/modules/scanner/scanner.events.js';

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

afterEach(async () => {
  await demoService.removeLegacyData();
  await prisma.game.deleteMany({ where: { entryPath: '/games/real.7z' } });
});

describe('demoService', () => {
  it('resets to an empty library while retaining deterministic catalog', async () => {
    const games = await prisma.game.findMany({ orderBy: { id: 'asc' } });

    const expectedGames = DEMO_GAMES.slice(0, config.demoGameCount);
    expect(games).toHaveLength(0);
    expect(expectedGames).toHaveLength(config.demoGameCount);
  });

  it('reports demo status without exposing a mutation', () => {
    expect(demoService.status()).toEqual({ enabled: false, offline: false });
  });

  it('keeps demo database URL separate from normal database URL', () => {
    expect(config.demoDatabaseUrl).not.toBe(config.databaseUrl);
    expect(config.databaseUrl).toMatch(/^file:\//);
    expect(config.demoDatabaseUrl).toMatch(/^file:\/.*\.demo$/);
  });

  it('emits canonical progress events during demo scans', async () => {
    const scope = '/demo/sessions/timeline-test/';
    const run = await scannerRepository.create({ rootPath: scope, scope });
    const events: ScanProgressEvent[] = [];
    const unsubscribe = onProgress((event) => events.push(event));
    const delayDescriptor = Object.getOwnPropertyDescriptor(config, 'demoScanStepDelayMs');
    Object.defineProperty(config, 'demoScanStepDelayMs', { value: 0 });
    try {
      await demoService.runScan(run, scope);
    } finally {
      if (delayDescriptor) Object.defineProperty(config, 'demoScanStepDelayMs', delayDescriptor);
      unsubscribe();
    }

    const runEvents = events.filter((event) => event.scanRunId === run.id);
    expect(runEvents.slice(0, 4).map(({ phase, stage }) => [phase, stage])).toEqual([
      ['start', 'scan'],
      ['start', 'metadata'],
      ['start', 'artwork'],
      ['candidate', 'scan'],
    ]);
    const entries = DEMO_GAMES.slice(0, config.demoGameCount);
    const entryEvents = runEvents.slice(4, -1);
    expect(entryEvents).toHaveLength(entries.length * 4);
    for (const [index, game] of entries.entries()) {
      const events = entryEvents.slice(index * 4, (index + 1) * 4);
      expect(events.map(({ phase, stage }) => [phase, stage])).toEqual([
        ['candidate', 'metadata'],
        ['matched', 'metadata'],
        ['matched', 'artwork'],
        ['matched', 'scan'],
      ]);
      expect(events.map(({ currentEntry }) => currentEntry)).toEqual(Array(4).fill(game.entryName));
    }
    expect(runEvents.at(-1)).toMatchObject({ phase: 'done', stage: 'done', found: config.demoGameCount });
    expect(await scannerRepository.findById(run.id)).toMatchObject({ status: 'DONE', found: config.demoGameCount });
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
