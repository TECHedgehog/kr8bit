import type { EntryType, MatchStatus } from '../../shared/enums.js';
import type { SteamDeckCompatItem } from '../../shared/types.js';

export interface Game {
  id: string;
  entryPath: string;
  entryType: EntryType;
  entryName: string;
  sizeBytes: number;
  steamAppId: number | null;
  title: string | null;
  displayName: string;
  releaseYear: number | null;
  description: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  coverUrl: string | null;
  headerUrl: string | null;
  heroUrl: string | null;
  logoUrl: string | null;
  screenshots: { url: string; thumbnailUrl: string }[];
  videos: { url: string; thumbnailUrl: string; name?: string; hlsUrl?: string }[];
  steamDeckCategory: number | null;
  steamDeckItems: SteamDeckCompatItem[];
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
  heroUrl?: string | null;
  logoUrl?: string | null;
  screenshots?: { url: string; thumbnailUrl: string }[];
  videos?: { url: string; thumbnailUrl: string; name?: string; hlsUrl?: string }[];
  steamDeckCategory?: number | null;
  steamDeckItems?: SteamDeckCompatItem[];
  matchStatus?: MatchStatus;
  matchScore?: number | null;
  matchedAt?: Date | null;
}

export type SortKey =
  | 'title-asc'
  | 'title-desc'
  | 'newest'
  | 'oldest'
  | 'largest'
  | 'smallest';

export const DEFAULT_SORT: SortKey = 'title-asc';

export const SORT_KEYS: readonly SortKey[] = [
  'title-asc',
  'title-desc',
  'newest',
  'oldest',
  'largest',
  'smallest',
];

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === 'string' && (SORT_KEYS as readonly string[]).includes(value);
}

export interface GameListFilter {
  search?: string;
  genres?: string[];
  steamDeck?: number[];
  limit?: number;
  offset?: number;
  sort?: SortKey;
}

export interface GameListResult {
  items: Game[];
  total: number;
}