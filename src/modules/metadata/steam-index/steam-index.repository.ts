import { prisma } from '../../../prisma-client.js';
import { mapPrismaError } from '../../../shared/prisma-errors.js';
import { logger } from '../../../logger/index.js';
import type { SteamAppListEntry } from '../steam/steam.http.types.js';

export interface SteamAppIndexRow {
  appId: number;
  name: string;
}

const REPLACE_BATCH_SIZE = 5000;

export const steamIndexRepository = {
  async count(): Promise<number> {
    return prisma.steamAppIndex.count();
  },

  async findAll(): Promise<SteamAppIndexRow[]> {
    const rows = await prisma.steamAppIndex.findMany();
    return rows.map((r) => ({ appId: r.appId, name: r.name }));
  },

  async replaceAll(entries: SteamAppListEntry[]): Promise<number> {
    // Single transaction: truncate + chunked createMany. Holds SQLite write lock
    // for the duration (~5-15s on a typical host for ~150k rows).
    const inserted = await prisma.$transaction(async (tx) => {
      await tx.steamAppIndex.deleteMany({});
      let count = 0;
      for (let i = 0; i < entries.length; i += REPLACE_BATCH_SIZE) {
        const batch = entries.slice(i, i + REPLACE_BATCH_SIZE);
        await tx.steamAppIndex.createMany({
          data: batch.map((e) => ({
            appId: e.appid,
            name: e.name,
            indexedAt: new Date(),
          })),
        });
        count += batch.length;
      }
      return count;
    }, { timeout: 120_000 });
    logger.info({ count: inserted }, 'steam app index replaced');
    return inserted;
  },

  async searchByName(name: string, limit: number): Promise<SteamAppIndexRow[]> {
    try {
      const rows = await prisma.steamAppIndex.findMany({
        where: { name: { contains: name } },
        take: limit,
      });
      return rows.map((r) => ({ appId: r.appId, name: r.name }));
    } catch (err) {
      throw mapPrismaError(err, 'SteamAppIndex', 'search');
    }
  },
};