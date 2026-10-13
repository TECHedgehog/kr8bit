import { promises as fs } from 'node:fs';
import { dirname, extname, join, basename } from 'node:path';
import { ConflictError, ValidationError } from '../../shared/errors.js';
import type { Game } from './library.types.js';
import { renderFilenameFormat } from './filename-format.js';

function safeName(title: string): string {
  const value = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  if (!value || value === '.' || value === '..') throw new ValidationError('metadata title cannot form a filesystem name');
  return value;
}

export function targetPath(game: Game, format: string): string {
  const name = safeName(renderFilenameFormat(game, format));
  return join(dirname(game.entryPath), game.entryType === 'ARCHIVE' ? `${name}${extname(game.entryName)}` : name);
}

export const filesystemRenameService = {
  async targetExists(path: string): Promise<boolean> {
    try {
      await fs.stat(path);
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw err;
    }
  },

  async rename(game: Game, format: string): Promise<{ oldPath: string; newPath: string }> {
    const newPath = targetPath(game, format);
    if (newPath === game.entryPath) return { oldPath: game.entryPath, newPath };
    try {
      await fs.stat(newPath);
      throw new ConflictError(`target already exists: ${basename(newPath)}`);
    } catch (err) {
      if (err instanceof ConflictError) throw err;
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    await fs.rename(game.entryPath, newPath);
    return { oldPath: game.entryPath, newPath };
  },
};
