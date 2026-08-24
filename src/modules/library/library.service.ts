import { ValidationError } from '../../shared/errors.js';
import { libraryRepository } from '../library/library.repository.js';
import {
  DEFAULT_SORT,
  isSortKey,
} from './library.types.js';
import type { Game, GameListFilter, GameListResult, GameUpdateInput, SortKey } from './library.types.js';

export interface NormalizedListFilter {
  search?: string;
  genres?: string[];
  steamDeck?: number[];
  limit: number;
  offset: number;
  sort: SortKey;
}

export function parseListFilter(query: Record<string, string | undefined>): NormalizedListFilter {
  let limit = 50;
  let offset = 0;
  if (query.limit !== undefined) {
    const parsed = Number(query.limit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new ValidationError('limit must be a positive integer');
    }
    limit = parsed;
  }
  if (query.offset !== undefined) {
    const parsed = Number(query.offset);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new ValidationError('offset must be a non-negative integer');
    }
    offset = parsed;
  }
  limit = Math.min(limit, 200);
  const search = query.search?.trim() || undefined;
  const sort: SortKey = isSortKey(query.sort) ? query.sort : DEFAULT_SORT;
  const genres = parseGenres(query.genre);
  const steamDeck = parseDeck(query.deck);
  return { search, genres, steamDeck, limit, offset, sort };
}

function parseGenres(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const genres = raw.split(',').map((g) => g.trim()).filter(Boolean);
  return genres.length ? genres : undefined;
}

function parseDeck(raw: string | undefined): number[] | undefined {
  if (!raw?.trim()) return undefined;
  const parts = raw.split(',').map((d) => d.trim()).filter(Boolean);
  const cats: number[] = [];
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 3) {
      throw new ValidationError('deck must be comma-separated integers 0-3');
    }
    cats.push(n);
  }
  return cats.length ? cats : undefined;
}

export function sanitizeGamePatch(body: unknown): GameUpdateInput {
  if (body === null || typeof body !== 'object') {
    return {};
  }
  const raw = body as Record<string, unknown>;
  const patch: GameUpdateInput = {};
  if (typeof raw.title === 'string' || raw.title === null) patch.title = raw.title as string | null;
  if (typeof raw.releaseYear === 'number' || raw.releaseYear === null) {
    patch.releaseYear = raw.releaseYear as number | null;
    if (typeof patch.releaseYear === 'number' && (patch.releaseYear < 1950 || patch.releaseYear > 2100)) {
      throw new ValidationError('releaseYear out of range');
    }
  }
  if (typeof raw.description === 'string' || raw.description === null) patch.description = raw.description as string | null;
  if (Array.isArray(raw.developers)) patch.developers = (raw.developers as unknown[]).map(String);
  if (Array.isArray(raw.publishers)) patch.publishers = (raw.publishers as unknown[]).map(String);
  if (Array.isArray(raw.genres)) patch.genres = (raw.genres as unknown[]).map(String);
  return patch;
}

export const libraryService = {
  parseListFilter,
  sanitizeGamePatch,

  async list(filter: GameListFilter): Promise<GameListResult> {
    return libraryRepository.list(filter);
  },

  async listGenres(): Promise<string[]> {
    return libraryRepository.findDistinctGenres();
  },

  async getById(id: string): Promise<Game> {
    return libraryRepository.findById(id);
  },

  async update(id: string, input: GameUpdateInput): Promise<Game> {
    return libraryRepository.update(id, input);
  },

  async delete(id: string): Promise<void> {
    return libraryRepository.delete(id);
  },

  async cleanOrphans(): Promise<{ orphanedProviderMatches: number; staleSteamAppIds: number }> {
    const [orphanedProviderMatches, staleSteamAppIds] = await Promise.all([
      libraryRepository.cleanOrphanedProviderMatches(),
      libraryRepository.cleanStaleSteamAppIds(),
    ]);
    return { orphanedProviderMatches, staleSteamAppIds };
  },
};
