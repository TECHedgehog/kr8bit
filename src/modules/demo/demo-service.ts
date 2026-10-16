import { prisma } from '../../prisma-client.js';
import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';
import type { MetadataProvider } from '../../shared/types.js';
import { steamProvider } from '../metadata/steam/steam.provider.js';
import { DEMO_GAMES } from './demo-data.js';
import { seedDemoCatalog, refreshDemoMetadata } from './demo-scan-deps.js';
import { LEGACY_DEMO_LIBRARY_PREFIX } from '../../http/demo-session.js';

export const demoService = {
  async removeLegacyData(): Promise<void> {
    const demoIds = DEMO_GAMES.map(({ id }) => id);
    await prisma.$transaction([
      prisma.providerMatch.deleteMany({ where: { gameId: { in: demoIds } } }),
      prisma.game.deleteMany({
        where: {
          OR: [
            { id: { in: demoIds } },
            { entryPath: { startsWith: LEGACY_DEMO_LIBRARY_PREFIX } },
          ],
        },
      }),
    ]);
    logger.info('legacy demo data cleanup complete');
  },

  async resetAndSeed(provider: MetadataProvider = steamProvider): Promise<void> {
    await seedDemoCatalog(provider);
    await prisma.$transaction([
      prisma.providerMatch.deleteMany(),
      prisma.game.deleteMany(),
      prisma.scanRun.deleteMany(),
      prisma.setting.deleteMany(),
      prisma.steamAppIndex.deleteMany(),
    ]);
    logger.info({ games: 0, catalog: Math.min(DEMO_GAMES.length, config.demoGameCount) }, 'demo library reset');
  },

  async refreshMetadata(provider: MetadataProvider = steamProvider): Promise<void> {
    await refreshDemoMetadata(provider);
  },

  status(): { enabled: boolean; offline: boolean } {
    return { enabled: config.demoMode, offline: false };
  },
};
