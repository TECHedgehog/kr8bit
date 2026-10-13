import { ValidationError } from '../../shared/errors.js';
import { libraryRepository } from '../library/library.repository.js';
import {
  DEFAULT_SORT,
  MAX_PAGE_SIZE,
  isSortKey,
} from './library.types.js';
import type { Game, GameListFilter, GameListResult, GameUpdateInput, SortKey } from './library.types.js';
import type { GameRenamePreview, GameRenameResult } from './library.types.js';
import { filesystemRenameService, targetPath } from './filesystem-rename.service.js';
import { CUSTOM_FORMAT_SETTING, DEFAULT_FILENAME_FORMAT, validateFilenameFormat } from './filename-format.js';
import { settingsRepository } from '../settings/settings.repository.js';

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
  limit = Math.min(limit, MAX_PAGE_SIZE);
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

  async list(filter: GameListFilter, scope?: string): Promise<GameListResult> {
    return libraryRepository.list(filter, scope);
  },

  async listGenres(scope?: string): Promise<string[]> {
    return libraryRepository.findDistinctGenres(scope);
  },

  async getById(id: string, scope?: string): Promise<Game> {
    return libraryRepository.findById(id, scope);
  },

  async update(id: string, input: GameUpdateInput, scope?: string): Promise<Game> {
    return libraryRepository.update(id, input, scope);
  },

  async delete(id: string, scope?: string): Promise<void> {
    return libraryRepository.delete(id, scope);
  },

  async rename(ids: string[], scope?: string, formatOverride?: string): Promise<GameRenameResult[]> {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 10000) {
      throw new ValidationError('ids must contain between 1 and 10000 game IDs');
    }
    const results: GameRenameResult[] = [];
    const settings = await settingsRepository.list();
    const defaultFormat = DEFAULT_FILENAME_FORMAT;
    const customFormat = formatOverride ?? settings.find((entry) => entry.key === CUSTOM_FORMAT_SETTING)?.value;
    const format = customFormat?.trim() || defaultFormat;
    validateFilenameFormat(format);
    for (const id of [...new Set(ids)]) {
      const game = await libraryRepository.findById(id, scope);
      try {
        const paths = await filesystemRenameService.rename(game, format);
        if (paths.oldPath === paths.newPath) {
          results.push({ id, oldPath: paths.oldPath, newPath: paths.newPath, status: 'skipped', message: 'already named' });
          continue;
        }
        await libraryRepository.updateEntry(id, paths.newPath, paths.newPath.split(/[\\/]/).pop() ?? game.entryName, scope);
        results.push({ id, ...paths, status: 'renamed' });
      } catch (err) {
        results.push({ id, oldPath: game.entryPath, newPath: null, status: 'failed', message: (err as Error).message });
      }
    }
    return results;
  },

  async previewRename(scope?: string, formatOverride?: string): Promise<GameRenamePreview[]> {
    const settings = await settingsRepository.list();
    const customFormat = formatOverride ?? settings.find((entry) => entry.key === CUSTOM_FORMAT_SETTING)?.value;
    const format = customFormat?.trim() || DEFAULT_FILENAME_FORMAT;
    validateFilenameFormat(format);
    const games = await libraryRepository.listAll(scope);
    const previews: GameRenamePreview[] = [];
    for (const game of games) {
      if (!game.title?.trim()) {
        previews.push({ id: game.id, oldName: game.entryName, newName: null, status: 'unavailable', message: 'missing metadata title' });
        continue;
      }
      try {
        const newPath = targetPath(game, format);
        const newName = newPath.split(/[\\/]/).pop() ?? newPath;
        if (newPath === game.entryPath) {
          previews.push({ id: game.id, oldName: game.entryName, newName, status: 'unchanged', message: 'already named' });
        } else if (await filesystemRenameService.targetExists(newPath)) {
          previews.push({ id: game.id, oldName: game.entryName, newName, status: 'conflict', message: 'target already exists' });
        } else {
          previews.push({ id: game.id, oldName: game.entryName, newName, status: 'ready' });
        }
      } catch (err) {
        previews.push({ id: game.id, oldName: game.entryName, newName: null, status: 'unavailable', message: (err as Error).message });
      }
    }
    return previews;
  },
};
