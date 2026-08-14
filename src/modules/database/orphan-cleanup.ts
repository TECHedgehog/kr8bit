import { prisma } from '../../prisma-client.js';
import { logger } from '../../logger/index.js';
import { MatchStatus } from '../../shared/enums.js';

export async function findOrphanedProviderMatches(): Promise<string[]> {
  const [matches, games] = await Promise.all([
    prisma.providerMatch.findMany({ select: { id: true, gameId: true } }),
    prisma.game.findMany({ select: { id: true } }),
  ]);
  const gameIds = new Set(games.map((g) => g.id));
  return matches.filter((m) => !gameIds.has(m.gameId)).map((m) => m.id);
}

export async function cleanOrphanedProviderMatches(): Promise<number> {
  const orphanIds = await findOrphanedProviderMatches();
  if (orphanIds.length === 0) return 0;
  const result = await prisma.providerMatch.deleteMany({
    where: { id: { in: orphanIds } },
  });
  logger.info({ count: result.count }, 'orphaned provider matches cleaned');
  return result.count;
}

export async function findStaleSteamAppIds(): Promise<
  { id: string; entryName: string; steamAppId: number }[]
> {
  const rows = await prisma.game.findMany({
    where: {
      steamAppId: { not: null },
      matchStatus: { notIn: [MatchStatus.ACCEPTED, MatchStatus.MANUAL] },
    },
    select: { id: true, entryName: true, steamAppId: true },
  });
  return rows.map((r) => ({
    id: r.id,
    entryName: r.entryName,
    steamAppId: r.steamAppId!,
  }));
}

export async function cleanStaleSteamAppIds(): Promise<number> {
  const result = await prisma.game.updateMany({
    where: {
      steamAppId: { not: null },
      matchStatus: { notIn: [MatchStatus.ACCEPTED, MatchStatus.MANUAL] },
    },
    data: { steamAppId: null },
  });
  logger.info({ count: result.count }, 'stale steamAppIds cleaned');
  return result.count;
}
