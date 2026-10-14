import { prisma } from '../../prisma-client.js';
export const databaseRepository = {
  async wipeAll() {
    const [providerMatches, games, scanRuns, steamApps, settings, repackPosts, repackGames] = await prisma.$transaction([
      prisma.providerMatch.deleteMany({}),
      prisma.game.deleteMany({}),
      prisma.scanRun.deleteMany({}),
      prisma.steamAppIndex.deleteMany({}),
      prisma.setting.deleteMany({}),
      prisma.repackPost.deleteMany({}),
      prisma.repackGame.deleteMany({}),
    ]);
    return {
      providerMatches: providerMatches.count,
      games: games.count,
      scanRuns: scanRuns.count,
      steamApps: steamApps.count,
      settings: settings.count,
      repackPosts: repackPosts.count,
      repackGames: repackGames.count,
    };
  },
};
