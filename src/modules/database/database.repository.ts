import { prisma } from '../../prisma-client.js';
export const databaseRepository = {
  async wipeAll() {
    const [providerMatches, games, scanRuns, steamApps, settings] = await prisma.$transaction([
      prisma.providerMatch.deleteMany({}),
      prisma.game.deleteMany({}),
      prisma.scanRun.deleteMany({}),
      prisma.steamAppIndex.deleteMany({}),
      prisma.setting.deleteMany({}),
    ]);
    return {
      providerMatches: providerMatches.count,
      games: games.count,
      scanRuns: scanRuns.count,
      steamApps: steamApps.count,
      settings: settings.count,
    };
  },
};
