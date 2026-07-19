import type { EntryType, MatchStatus } from '../../shared/enums.js';

export interface Game {
  id: string;
  entryPath: string;
  entryType: EntryType;
  entryName: string;
  sizeBytes: number;
  steamAppId: number | null;
  title: string | null;
  releaseYear: number | null;
  description: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  coverUrl: string | null;
  headerUrl: string | null;
  matchStatus: MatchStatus;
  matchScore: number | null;
  matchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameCreateInput {
  entryPath: string;
  entryType: EntryType;
  entryName: string;
  sizeBytes: number;
  matchStatus: MatchStatus;
}

export interface GameUpdateInput {
  steamAppId?: number | null;
  title?: string | null;
  releaseYear?: number | null;
  description?: string | null;
  developers?: string[];
  publishers?: string[];
  genres?: string[];
  coverUrl?: string | null;
  headerUrl?: string | null;
  matchStatus?: MatchStatus;
  matchScore?: number | null;
  matchedAt?: Date | null;
}

export interface GameListFilter {
  matchStatus?: MatchStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GameListResult {
  items: Game[];
  total: number;
}