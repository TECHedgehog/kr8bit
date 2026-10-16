import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { config } from '../src/config/index.js';
import { demoService } from '../src/modules/demo/demo-service.js';
import { DEMO_GAMES } from '../src/modules/demo/demo-data.js';
import { scannerRepository } from '../src/modules/scanner/scanner.repository.js';
import { onProgress, type ScanProgressEvent } from '../src/modules/scanner/scanner.events.js';
import { demoScannerDeps } from '../src/modules/demo/demo-scan-deps.js';
import { ScannerService } from '../src/modules/scanner/scanner.service.js';
import { createLibraryRepository } from '../src/modules/library/library.repository.js';
import { MatchStatus } from '../src/shared/enums.js';
import { demoSessionRoot } from '../src/http/demo-session.js';

const timelineScope = demoSessionRoot('timeline-test');

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
  await prisma.game.deleteMany({ where: { entryPath: { startsWith: timelineScope } } });
  await prisma.scanRun.deleteMany({ where: { rootPath: timelineScope } });
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

  it('runs demo entries through the scanner and writes scoped library rows', async () => {
    const scope = timelineScope;
    await demoService.resetAndSeed({
      name: 'steam',
      search: vi.fn(),
      getGame: vi.fn(async (remoteId: string) => Number(remoteId) === DEMO_GAMES[0].appId ? null : ({
        remoteId,
        title: `Demo ${remoteId}`,
        releaseYear: 2020,
        description: 'Demo description',
        developers: ['Demo Studio'],
        publishers: ['Demo Publisher'],
        genres: ['Action'],
      })),
    });
    const events: ScanProgressEvent[] = [];
    const unsubscribe = onProgress((event) => events.push(event));
    const delayDescriptor = Object.getOwnPropertyDescriptor(config, 'demoScanStepDelayMs');
    Object.defineProperty(config, 'demoScanStepDelayMs', { value: 0 });
    const service = new ScannerService(demoScannerDeps());
    let resolveDone!: () => void;
    const completed = new Promise<void>((resolve) => { resolveDone = resolve; });
    let runId: string | undefined;
    const onEvent = onProgress((event) => {
      if (event.scanRunId === runId && event.phase === 'done') resolveDone();
    });
    try {
      const run = await service.start(scope);
      runId = run.id;
      if (events.some((event) => event.scanRunId === run.id && event.phase === 'done')) resolveDone();
      await completed;
      const rows = await createLibraryRepository(scope).list({ limit: config.demoGameCount });
      expect(rows.total).toBe(config.demoGameCount);
      expect(rows.items.find(({ entryName }) => entryName === `${DEMO_GAMES[0].entryName}.7z`)).toMatchObject({
        matchStatus: MatchStatus.PENDING,
        steamAppId: null,
      });
      expect(rows.items.find(({ entryName }) => entryName === `${DEMO_GAMES[1].entryName}.7z`)).toMatchObject({
        matchStatus: MatchStatus.ACCEPTED,
        steamAppId: DEMO_GAMES[1].appId,
        title: `Demo ${DEMO_GAMES[1].appId}`,
      });
    } finally {
      if (delayDescriptor) Object.defineProperty(config, 'demoScanStepDelayMs', delayDescriptor);
      onEvent();
      unsubscribe();
    }

    const runEvents = events.filter((event) => event.scanRunId === runId);
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
      expect(events.map(({ currentEntry }) => currentEntry)).toEqual(Array(4).fill(`${game.entryName}.7z`));
    }
    expect(runEvents.at(-1)).toMatchObject({ phase: 'done', stage: 'done', found: config.demoGameCount });
    expect(await scannerRepository.findById(runId!)).toMatchObject({ status: 'DONE', found: config.demoGameCount });
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
