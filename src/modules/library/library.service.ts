import { MatchStatus } from '../../shared/enums.js';
import { ValidationError } from '../../shared/errors.js';
import { libraryRepository } from '../library/library.repository.js';
import type { Game, GameListFilter, GameListResult, GameUpdateInput } from './library.types.js';

export interface NormalizedListFilter {
  matchStatus?: MatchStatus;
  search?: string;
  limit: number;
  offset: number;
}

export function parseListFilter(query: Record<string, string | undefined>): NormalizedListFilter {
  const validStatuses = new Set<string>(Object.values(MatchStatus));
  let matchStatus: MatchStatus | undefined;
  if (query.status) {
    if (!validStatuses.has(query.status)) {
      throw new ValidationError(`invalid status: ${query.status}`);
    }
    matchStatus = query.status as MatchStatus;
  }

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
  return { matchStatus, search, limit, offset, };
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

  async getById(id: string): Promise<Game> {
    return libraryRepository.findById(id);
  },

  async update(id: string, input: GameUpdateInput): Promise<Game> {
    return libraryRepository.update(id, input);
  },

  async delete(id: string): Promise<void> {
    return libraryRepository.delete(id);
  },
};