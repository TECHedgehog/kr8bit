import { prisma } from '../../prisma-client.js';
export const databaseRepository = {
  async wipeLibrary() {
    const [providerMatches, games, scanRuns] = await prisma.$transaction([
      prisma.providerMatch.deleteMany({}),
      prisma.game.deleteMany({}),
      prisma.scanRun.deleteMany({}),
      prisma.setting.upsert({
        where: { key: 'libraryManuallyCleared' },
        create: { key: 'libraryManuallyCleared', value: 'true' },
        update: { value: 'true' },
      }),
    ]);
    return {
      providerMatches: providerMatches.count,
      games: games.count,
      scanRuns: scanRuns.count,
    };
  },

  async wipeRepack() {
    const [repackPosts, repackGames] = await prisma.$transaction([
      prisma.repackPost.deleteMany({}),
      prisma.repackGame.deleteMany({}),
      prisma.setting.upsert({
        where: { key: 'repackCatalogFullImportComplete' },
        create: { key: 'repackCatalogFullImportComplete', value: 'false' },
        update: { value: 'false' },
      }),
    ]);
    return {
      repackPosts: repackPosts.count,
      repackGames: repackGames.count,
    };
  },

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
