import { prisma } from '../../prisma-client.js';
import { logger } from '../../logger/index.js';
import { mapPrismaError } from '../../shared/prisma-errors.js';
import { NotFoundError } from '../../shared/errors.js';
import { MatchStatus } from '../../shared/enums.js';
import { encodeArray } from '../../shared/json.js';
import { toDomain } from './library.mapper.js';
import type {
  Game,
  GameCreateInput,
  GameUpdateInput,
  GameListFilter,
  GameListResult,
} from './library.types.js';

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
    if (filter.matchStatus) where.matchStatus = filter.matchStatus;
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
    const rows = await prisma.game.findMany({
      where: {
        matchStatus: { in: [MatchStatus.ACCEPTED, MatchStatus.FLAGGED] },
        description: null,
        coverUrl: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  },
};