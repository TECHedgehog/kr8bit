import type { Game as PrismaGame } from '@prisma/client';
import type { Game } from './library.types.js';
import { decodeArray } from '../../shared/json.js';
import type { EntryType, MatchStatus } from '../../shared/enums.js';

export function toDomain(row: PrismaGame): Game {
  return {
    id: row.id,
    entryPath: row.entryPath,
    entryType: row.entryType as EntryType,
    entryName: row.entryName,
    sizeBytes: Number(row.sizeBytes),
    steamAppId: row.steamAppId,
    title: row.title,
    releaseYear: row.releaseYear,
    description: row.description,
    developers: decodeArray(row.developers),
    publishers: decodeArray(row.publishers),
    genres: decodeArray(row.genres),
    coverUrl: row.coverUrl,
    headerUrl: row.headerUrl,
    matchStatus: row.matchStatus as MatchStatus,
    matchScore: row.matchScore,
    matchedAt: row.matchedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}