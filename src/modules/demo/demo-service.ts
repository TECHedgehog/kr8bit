import { prisma } from '../../prisma-client.js';
import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';
import { encodeArray } from '../../shared/json.js';
import { MatchStatus, ScanStatus } from '../../shared/enums.js';
import { scannerRepository } from '../scanner/scanner.repository.js';
import { emitProgress } from '../scanner/scanner.events.js';
import type { ScanRun } from '../scanner/scanner.types.js';
import { DEMO_GAMES } from './demo-data.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const demoService = {
  async resetAndSeed(): Promise<void> {
    await prisma.$transaction([
      prisma.providerMatch.deleteMany(),
      prisma.game.deleteMany(),
      prisma.scanRun.deleteMany(),
      prisma.setting.deleteMany(),
      prisma.steamAppIndex.deleteMany(),
    ]);
    const matchedAt = new Date('2024-01-01T00:00:00.000Z');
    await prisma.game.createMany({
      data: DEMO_GAMES.map((game) => ({
        id: game.id,
        entryPath: game.entryPath,
        entryType: game.entryPath.endsWith('/') ? 'DIRECTORY' : 'ARCHIVE',
        entryName: game.entryName,
        sizeBytes: BigInt(game.sizeBytes),
        steamAppId: game.steamAppId,
        title: game.title,
        releaseYear: game.releaseYear,
        description: game.description,
        developers: encodeArray([...game.developers]),
        publishers: encodeArray([...game.publishers]),
        genres: encodeArray([...game.genres]),
        screenshots: '[]',
        videos: '[]',
        steamDeckItems: '[]',
        matchStatus: game.title ? MatchStatus.ACCEPTED : MatchStatus.PENDING,
        matchScore: game.title ? 100 : null,
        matchedAt: game.title ? matchedAt : null,
      })),
    });
    logger.info({ games: DEMO_GAMES.length }, 'demo data seeded');
  },

  async runScan(run: ScanRun): Promise<void> {
    const found = DEMO_GAMES.length;
    let completed = 0;
    emitProgress({ scanRunId: run.id, phase: 'start', found: 0, added: 0, updated: 0, failed: 0 });
    await sleep(Math.max(100, config.demoScanStepDelayMs));
    for (const game of DEMO_GAMES) {
      emitProgress({ scanRunId: run.id, phase: 'candidate', found, added: completed, updated: 0, failed: 0, currentEntry: game.entryName });
      await sleep(config.demoScanStepDelayMs);
      completed += 1;
      emitProgress({ scanRunId: run.id, phase: 'matched', found, added: completed, updated: 0, failed: 0, currentEntry: game.entryName });
    }
    await scannerRepository.update(run.id, { status: ScanStatus.DONE, finishedAt: new Date(), found, added: found, updated: 0, failed: 0, errors: [] });
    emitProgress({ scanRunId: run.id, phase: 'done', found, added: found, updated: 0, failed: 0 });
  },

  status(): { enabled: boolean; offline: boolean } {
    return { enabled: config.demoMode, offline: config.demoMode };
  },
};
