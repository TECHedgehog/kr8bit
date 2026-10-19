import { prisma } from '../../prisma-client.js';
import { logger } from '../../logger/index.js';
import { config } from '../../config/index.js';
import { mapPrismaError } from '../../shared/prisma-errors.js';
import { NotFoundError } from '../../shared/errors.js';
import { MatchStatus, RE_MATCHABLE_STATUSES } from '../../shared/enums.js';
import { encodeArray, decodeArray } from '../../shared/json.js';
import { toDomain } from './library.mapper.js';
import type {
  Game,
  GameCreateInput,
  GameUpdateInput,
  GameListFilter,
  GameListResult,
  SortKey,
} from './library.types.js';
import { DEFAULT_SORT, MAX_PAGE_SIZE } from './library.types.js';
import { settingsRepository } from '../settings/settings.repository.js';
import { createSettingsReader } from '../settings/settings.reader.js';
import { LIBRARY_MANUALLY_CLEARED_SETTING_SPEC } from './library.settings.js';
import { dirname, sep } from 'node:path';
import { normalizeForMatch, normalizeGameName } from '../../shared/normalize.js';

const REFRESH_BATCH_SIZE = 500;
const PENDING_BATCH_SIZE = 500;
const settingsReader = createSettingsReader(settingsRepository);

type GameOrderBy = Record<string, unknown>;

function scopedWhere(scope?: string): Record<string, unknown> {
  return scope ? { entryPath: { startsWith: scope } } : {};
}

function sortToOrderBy(sort: SortKey): GameOrderBy {
  switch (sort) {
    case 'title-asc':
      return { title: { sort: 'asc', nulls: 'last' } };
    case 'title-desc':
      return { title: { sort: 'desc', nulls: 'last' } };
    case 'newest':
      return { updatedAt: 'desc' };
    case 'oldest':
      return { createdAt: 'asc' };
    case 'largest':
      return { sizeBytes: 'desc' };
    case 'smallest':
      return { sizeBytes: 'asc' };
  }
}

export function createLibraryRepository(scope?: string) {
  const scopeWhere = scopedWhere(scope);

  return {
    async create(input: GameCreateInput): Promise<Game> {
      try {
        const row = await prisma.game.create({
          data: {
            entryPath: input.entryPath,
            entryType: input.entryType,
            entryName: input.entryName,
            originalEntryName: input.originalEntryName ?? input.entryName,
            releaseVersion: input.releaseVersion,
            releaseDlcs: encodeArray(input.releaseDlcs ?? []),
            releaseGroup: input.releaseGroup,
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
        const row = scope
          ? await prisma.game.findFirst({ where: { id, ...scopeWhere } })
          : await prisma.game.findUnique({ where: { id } });
        if (!row) throw new NotFoundError('Game', id);
        return toDomain(row);
      } catch (err) {
        throw mapPrismaError(err, 'Game', id);
      }
    },

    async findByEntryPath(entryPath: string): Promise<Game | null> {
      try {
        const row = scope
          ? await prisma.game.findFirst({ where: { entryPath, AND: [scopeWhere] } })
          : await prisma.game.findUnique({ where: { entryPath } });
        return row ? toDomain(row) : null;
      } catch (err) {
        throw mapPrismaError(err, 'Game', entryPath);
      }
    },

    async findByTitleAndDirectory(title: string, directory: string): Promise<Game | null> {
      try {
        const parentPrefix = directory.endsWith(sep) ? directory : `${directory}${sep}`;
        const rows = await prisma.game.findMany({
          where: { AND: [{ entryPath: { startsWith: parentPrefix } }, scopeWhere] },
        });
        const normalizedTitle = normalizeForMatch(title);
        const row = rows.find((candidate) => {
          const sameDirectory = dirname(candidate.entryPath) === directory;
          const normalizedEntry = normalizeForMatch(normalizeGameName(candidate.entryName).query);
          const normalizedMetadata = normalizeForMatch(normalizeGameName(candidate.title ?? '').query);
          return sameDirectory && (
            normalizedEntry === normalizedTitle
            || normalizedMetadata === normalizedTitle
            || normalizedMetadata.includes(normalizedTitle)
          );
        });
        return row ? toDomain(row) : null;
      } catch (err) {
        throw mapPrismaError(err, 'Game', title);
      }
    },

    async list(filter: GameListFilter = {}): Promise<GameListResult> {
      const limit = Math.min(filter.limit ?? 50, MAX_PAGE_SIZE);
      const offset = Math.max(filter.offset ?? 0, 0);
      const orderBy = sortToOrderBy(filter.sort ?? DEFAULT_SORT);

      const conditions: Record<string, unknown>[] = [];
      if (filter.search) {
        conditions.push({
          OR: [
            { title: { contains: filter.search } },
            { entryName: { contains: filter.search } },
          ],
        });
      }
      if (filter.genres?.length) {
        conditions.push({
          OR: filter.genres.map((g) => ({ genres: { contains: JSON.stringify(g) } })),
        });
      }
      if (filter.steamDeck?.length) {
        conditions.push({
          OR: filter.steamDeck.map((cat) =>
            cat === 0
              ? { OR: [{ steamDeckCategory: null }, { steamDeckCategory: 0 }] }
              : { steamDeckCategory: cat },
          ),
        });
      }
      const where = { AND: [...conditions, scopeWhere] };

      try {
        const [rows, total] = await Promise.all([
          prisma.game.findMany({
            where,
            orderBy,
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

    async listAll(): Promise<Game[]> {
      try {
        const rows = await prisma.game.findMany({ where: scopeWhere, orderBy: { title: 'asc' } });
        return rows.map(toDomain);
      } catch (err) {
        throw mapPrismaError(err, 'Game', 'list-all');
      }
    },

    async update(id: string, input: GameUpdateInput): Promise<Game> {
      try {
        const data: Record<string, unknown> = {};
        if (input.originalEntryName !== undefined) data.originalEntryName = input.originalEntryName;
        if (input.releaseVersion !== undefined) data.releaseVersion = input.releaseVersion;
        if (input.releaseDlcs !== undefined) data.releaseDlcs = encodeArray(input.releaseDlcs);
        if (input.releaseGroup !== undefined) data.releaseGroup = input.releaseGroup;
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

        const existing = scope
          ? await prisma.game.findFirst({ where: { id, ...scopeWhere } })
          : await prisma.game.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Game', id);
        const row = await prisma.game.update({ where: { id: existing.id }, data });
        return toDomain(row);
      } catch (err) {
        throw mapPrismaError(err, 'Game', id);
      }
    },

    async updateEntry(id: string, entryPath: string, entryName: string): Promise<Game> {
      try {
        const existing = scope
          ? await prisma.game.findFirst({ where: { id, ...scopeWhere } })
          : await prisma.game.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Game', id);
        const row = await prisma.game.update({ where: { id: existing.id }, data: { entryPath, entryName } });
        return toDomain(row);
      } catch (err) {
        throw mapPrismaError(err, 'Game', id);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const existing = scope
          ? await prisma.game.findFirst({ where: { id, ...scopeWhere } })
          : await prisma.game.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Game', id);
        await prisma.game.delete({ where: { id: existing.id } });
        if (!scope && (await prisma.game.count()) === 0) {
          await settingsReader.write(LIBRARY_MANUALLY_CLEARED_SETTING_SPEC, true);
        }
        logger.info({ gameId: id }, 'game deleted from db');
      } catch (err) {
        throw mapPrismaError(err, 'Game', id);
      }
    },

    async count(): Promise<number> {
      try {
        return prisma.game.count({ where: scopeWhere });
      } catch (err) {
        throw mapPrismaError(err, 'Game', 'count');
      }
    },

    async findDistinctGenres(): Promise<string[]> {
      try {
        const rows = await prisma.game.findMany({ where: scopeWhere, select: { genres: true } });
        const set = new Set<string>();
        for (const row of rows) {
          for (const g of decodeArray(row.genres)) {
            set.add(g);
          }
        }
        return [...set].sort();
      } catch (err) {
        throw mapPrismaError(err, 'Game', 'genres');
      }
    },

    async findEligibleForRefresh(): Promise<Game[]> {
      const minAgeMs = config.metadata.refreshMinAgeMs;
      const cutoff = new Date(Date.now() - minAgeMs);
      try {
        const rows = await prisma.game.findMany({
          where: {
            matchStatus: { in: [MatchStatus.ACCEPTED, MatchStatus.FLAGGED, MatchStatus.MANUAL] },
            matchedAt: { lt: cutoff },
            OR: [
              { description: null },
              { coverUrl: null },
              { headerUrl: null },
              { heroUrl: null },
            ],
          },
          orderBy: { createdAt: 'asc' },
          take: REFRESH_BATCH_SIZE,
        });
        return rows.map(toDomain);
      } catch (err) {
        throw mapPrismaError(err, 'Game', 'refresh-eligible');
      }
    },

    async findPendingGames(): Promise<Game[]> {
      try {
        const rows = await prisma.game.findMany({
          where: {
            matchStatus: { in: RE_MATCHABLE_STATUSES },
          },
          orderBy: { createdAt: 'asc' },
          take: PENDING_BATCH_SIZE,
        });
        return rows.map(toDomain);
      } catch (err) {
        throw mapPrismaError(err, 'Game', 'pending');
      }
    },
    };
}

export const libraryRepository = createLibraryRepository();
