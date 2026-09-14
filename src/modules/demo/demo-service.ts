import { prisma } from '../../prisma-client.js';
import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';
import { MatchStatus, ScanStatus } from '../../shared/enums.js';
import { scannerRepository } from '../scanner/scanner.repository.js';
import { libraryRepository } from '../library/library.repository.js';
import { emitProgress } from '../scanner/scanner.events.js';
import type { ScanRun } from '../scanner/scanner.types.js';
import type { GameMetadata, MetadataProvider } from '../../shared/types.js';
import { steamProvider } from '../metadata/steam/steam.provider.js';
import { DEMO_GAMES } from './demo-data.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
let seededGames = DEMO_GAMES;
let metadataByAppId = new Map<number, GameMetadata>();

async function fetchDemoMetadata(
  games: typeof DEMO_GAMES,
  provider: MetadataProvider,
): Promise<Array<{ seed: (typeof DEMO_GAMES)[number]; metadata: GameMetadata }>> {
  const results: Array<{ seed: (typeof DEMO_GAMES)[number]; metadata: GameMetadata }> = [];
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < games.length) {
      const seed = games[nextIndex++];
      if (provider === steamProvider && nextIndex > 1) await sleep(config.demoSteamDelayMs);
      const metadata = await provider.getGame(String(seed.appId));
      if (metadata) results.push({ seed, metadata });
      else logger.warn({ appId: seed.appId }, 'demo game skipped; Steam metadata unavailable');
    }
  };
  await Promise.all(Array.from({ length: provider === steamProvider ? 1 : Math.min(4, games.length) }, () => worker()));
  return results;
}

export const demoService = {
  async removeLegacyData(): Promise<void> {
    const demoIds = DEMO_GAMES.map(({ id }) => id);
    await prisma.$transaction([
      prisma.providerMatch.deleteMany({ where: { gameId: { in: demoIds } } }),
      prisma.game.deleteMany({
        where: {
          OR: [
            { id: { in: demoIds } },
            { entryPath: { startsWith: '/demo/library/' } },
          ],
        },
      }),
    ]);
    logger.info('legacy demo data cleanup complete');
  },

  async resetAndSeed(provider: MetadataProvider = steamProvider): Promise<void> {
    const candidates = DEMO_GAMES.slice(0, config.demoGameCount);
    const available = provider === steamProvider ? [] : await fetchDemoMetadata(candidates, provider);
    seededGames = candidates;
    await prisma.$transaction([
      prisma.providerMatch.deleteMany(),
      prisma.game.deleteMany(),
      prisma.scanRun.deleteMany(),
      prisma.setting.deleteMany(),
      prisma.steamAppIndex.deleteMany(),
    ]);
    metadataByAppId = new Map(available.map(({ seed, metadata }) => [seed.appId, metadata]));
    logger.info({ games: 0, catalog: candidates.length, metadata: available.length }, 'demo library reset');
  },

  async refreshMetadata(provider: MetadataProvider = steamProvider): Promise<void> {
    const available = await fetchDemoMetadata(seededGames, provider);
    metadataByAppId = new Map(available.map(({ seed, metadata }) => [seed.appId, metadata]));
    const matchedAt = new Date();
    for (const { seed, metadata } of available) {
      const rows = await prisma.game.findMany({
        where: { entryPath: { endsWith: `/${seed.entryName}.7z` } },
        select: { id: true },
      });
      for (const row of rows) {
        await libraryRepository.update(row.id, {
          steamAppId: seed.appId,
          title: metadata.title,
          releaseYear: metadata.releaseYear ?? null,
          description: metadata.description ?? null,
          developers: [...metadata.developers],
          publishers: [...metadata.publishers],
          genres: [...metadata.genres],
          coverUrl: metadata.coverUrl ?? null,
          headerUrl: metadata.headerUrl ?? null,
          heroUrl: metadata.heroUrl ?? null,
          logoUrl: metadata.logoUrl ?? null,
          screenshots: metadata.screenshots ?? [],
          videos: metadata.videos ?? [],
          steamDeckCategory: metadata.steamDeckCompat?.category ?? null,
          steamDeckItems: metadata.steamDeckCompat?.items ?? [],
          matchStatus: MatchStatus.ACCEPTED,
          matchScore: 100,
          matchedAt,
        });
      }
    }
    logger.info({ games: available.length }, 'demo metadata refreshed');
  },

  async runScan(run: ScanRun, scope?: string): Promise<void> {
    const found = seededGames.length;
    let completed = 0;
    let added = 0;
    emitProgress({ scope, scanRunId: run.id, phase: 'start', found: 0, added: 0, updated: 0, failed: 0 });
    await sleep(Math.max(100, config.demoScanStepDelayMs));
    for (const game of seededGames) {
      emitProgress({ scope, scanRunId: run.id, phase: 'candidate', found, added: completed, updated: 0, failed: 0, currentEntry: game.entryName });
      await sleep(config.demoScanStepDelayMs);
      const entryPath = `${scope ?? '/demo/sessions/legacy/'}${game.entryName}.7z`;
      const existing = await libraryRepository.findByEntryPath(entryPath, scope);
      if (!existing) {
        const metadata = metadataByAppId.get(game.appId);
        const created = await libraryRepository.create({
          entryPath,
          entryType: 'ARCHIVE',
          entryName: `${game.entryName}.7z`,
          sizeBytes: game.sizeBytes,
          matchStatus: metadata ? MatchStatus.ACCEPTED : MatchStatus.PENDING,
        });
        added += 1;
        if (metadata) await libraryRepository.update(created.id, {
          steamAppId: game.appId,
          title: metadata.title,
          releaseYear: metadata.releaseYear ?? null,
          description: metadata.description ?? null,
          developers: [...metadata.developers],
          publishers: [...metadata.publishers],
          genres: [...metadata.genres],
          coverUrl: metadata.coverUrl ?? null,
          headerUrl: metadata.headerUrl ?? null,
          heroUrl: metadata.heroUrl ?? null,
          logoUrl: metadata.logoUrl ?? null,
          screenshots: metadata.screenshots ?? [],
          videos: metadata.videos ?? [],
          steamDeckCategory: metadata.steamDeckCompat?.category ?? null,
          steamDeckItems: metadata.steamDeckCompat?.items ?? [],
          matchStatus: MatchStatus.ACCEPTED,
          matchScore: 100,
          matchedAt: new Date('2024-01-01T00:00:00.000Z'),
        });
      }
      completed += 1;
      emitProgress({ scope, scanRunId: run.id, phase: 'matched', found, added, updated: 0, failed: 0, currentEntry: game.entryName });
    }
    await scannerRepository.update(run.id, { status: ScanStatus.DONE, finishedAt: new Date(), found, added, updated: 0, failed: 0, errors: [] });
    emitProgress({ scope, scanRunId: run.id, phase: 'done', found, added, updated: 0, failed: 0 });
  },

  status(): { enabled: boolean; offline: boolean } {
    return { enabled: config.demoMode, offline: false };
  },
};
