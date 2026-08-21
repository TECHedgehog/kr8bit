import { prisma } from '../../prisma-client.js';
import { logger } from '../../logger/index.js';
import { config } from '../../config/index.js';
import { mapPrismaError } from '../../shared/prisma-errors.js';
import { NotFoundError } from '../../shared/errors.js';
import { MatchStatus } from '../../shared/enums.js';
import { encodeArray } from '../../shared/json.js';
import { toDomain } from './library.mapper.js';
import {
  findOrphanedProviderMatches as findOrphanedProviderMatchesDb,
  cleanOrphanedProviderMatches as cleanOrphanedProviderMatchesDb,
  findStaleSteamAppIds as findStaleSteamAppIdsDb,
  cleanStaleSteamAppIds as cleanStaleSteamAppIdsDb,
} from '../database/orphan-cleanup.js';
import type {
  Game,
  GameCreateInput,
  GameUpdateInput,
  GameListFilter,
  GameListResult,
} from './library.types.js';

export const REFRESH_BATCH_SIZE = 500;
export const PENDING_BATCH_SIZE = 500;

export const libraryRepository = {
  async create(input: GameCreateInput): Promise<Game> {
    try {
      const row = await prisma.game.create({
        data: {
          entryPath: input.entryPath,
          entryType: input.entryType,
          entryName: input.entryName,
          sizeBytes: BigInt(input.sizeBytes),
          matchStatus: input.matchStatus,
          developers: encodeArray([]),
          publishers: encodeArray([]),
          genres: encodeArray([]),
          screenshots: JSON.stringify([]),
          videos: JSON.stringify([]),
          steamDeckItems: JSON.stringify([]),
        },
      });
      return toDomain(row);
    } catch (err) {
      throw mapPrismaError(err, 'Game', input.entryPath);
    }
  },

  async findById(id: string): Promise<Game> {
    try {
      const row = await prisma.game.findUnique({ where: { id } });
      if (!row) throw new NotFoundError('Game', id);
      return toDomain(row);
    } catch (err) {
      throw mapPrismaError(err, 'Game', id);
    }
  },

  async findByEntryPath(entryPath: string): Promise<Game | null> {
    const row = await prisma.game.findUnique({ where: { entryPath } });
    return row ? toDomain(row) : null;
  },

  async list(filter: GameListFilter = {}): Promise<GameListResult> {
    const limit = Math.min(filter.limit ?? 50, 200);
    const offset = Math.max(filter.offset ?? 0, 0);

    const where: Record<string, unknown> = {};
    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search } },
        { entryName: { contains: filter.search } },
      ];
    }

    try {
      const [rows, total] = await Promise.all([
        prisma.game.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.game.count({ where }),
      ]);
      return { items: rows.map(toDomain), total };
    } catch (err) {
      throw mapPrismaError(err, 'Game', 'list');
    }
  },

  async update(id: string, input: GameUpdateInput): Promise<Game> {
    try {
      const data: Record<string, unknown> = {};
      if (input.steamAppId !== undefined) data.steamAppId = input.steamAppId;
      if (input.title !== undefined) data.title = input.title;
      if (input.releaseYear !== undefined) data.releaseYear = input.releaseYear;
      if (input.description !== undefined) data.description = input.description;
      if (input.developers !== undefined) data.developers = encodeArray(input.developers);
      if (input.publishers !== undefined) data.publishers = encodeArray(input.publishers);
      if (input.genres !== undefined) data.genres = encodeArray(input.genres);
    if (input.coverUrl !== undefined) data.coverUrl = input.coverUrl;
    if (input.headerUrl !== undefined) data.headerUrl = input.headerUrl;
    if (input.heroUrl !== undefined) data.heroUrl = input.heroUrl;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
    if (input.screenshots !== undefined) data.screenshots = JSON.stringify(input.screenshots);
    if (input.videos !== undefined) data.videos = JSON.stringify(input.videos);
    if (input.steamDeckCategory !== undefined) data.steamDeckCategory = input.steamDeckCategory;
    if (input.steamDeckItems !== undefined) data.steamDeckItems = JSON.stringify(input.steamDeckItems);
    if (input.matchStatus !== undefined) data.matchStatus = input.matchStatus;
      if (input.matchScore !== undefined) data.matchScore = input.matchScore;
      if (input.matchedAt !== undefined) data.matchedAt = input.matchedAt;

      const row = await prisma.game.update({ where: { id }, data });
      return toDomain(row);
    } catch (err) {
      throw mapPrismaError(err, 'Game', id);
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await prisma.game.delete({ where: { id } });
      logger.info({ gameId: id }, 'game deleted from db');
    } catch (err) {
      throw mapPrismaError(err, 'Game', id);
    }
  },

  async count(): Promise<number> {
    return prisma.game.count();
  },

  async findEligibleForRefresh(): Promise<Game[]> {
    const minAgeMs = config.metadata.refreshMinAgeMs;
    const cutoff = new Date(Date.now() - minAgeMs);
    const rows = await prisma.game.findMany({
      where: {
        matchStatus: { in: [MatchStatus.ACCEPTED, MatchStatus.FLAGGED, MatchStatus.MANUAL] },
        matchedAt: { lt: cutoff },
        OR: [
          { description: null },
          { coverUrl: null },
          { headerUrl: null },
          { steamAppId: { not: null }, heroUrl: null },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: REFRESH_BATCH_SIZE,
    });
    return rows.map(toDomain);
  },

  async findPendingGames(): Promise<Game[]> {
    const rows = await prisma.game.findMany({
      where: {
        matchStatus: { in: [MatchStatus.PENDING, MatchStatus.FLAGGED, MatchStatus.REJECTED] },
      },
      orderBy: { createdAt: 'asc' },
      take: PENDING_BATCH_SIZE,
    });
    return rows.map(toDomain);
  },

  async findOrphanedProviderMatches(): Promise<string[]> {
    return findOrphanedProviderMatchesDb();
  },

  async cleanOrphanedProviderMatches(): Promise<number> {
    return cleanOrphanedProviderMatchesDb();
  },

  async findStaleSteamAppIds(): Promise<
    { id: string; entryName: string; steamAppId: number }[]
  > {
    return findStaleSteamAppIdsDb();
  },

  async cleanStaleSteamAppIds(): Promise<number> {
    return cleanStaleSteamAppIdsDb();
  },
};
