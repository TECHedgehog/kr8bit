import { promises as fs } from 'node:fs';
import { constants as fsConstants } from 'node:fs';
import { dirname, extname, join, basename, normalize } from 'node:path';
import { ConflictError, ValidationError } from '../../shared/errors.js';
import type { Game } from './library.types.js';
import { renderFilenameFormat } from './filename-format.js';

const MAX_FILENAME_BYTES = 200;

export function safeName(title: string): string {
  let value = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  if (!value || value === '.' || value === '..') throw new ValidationError('metadata title cannot form a filesystem name');
  value = [...value].reduce((result, character) => Buffer.byteLength(result + character, 'utf8') <= MAX_FILENAME_BYTES ? result + character : result, '');
  if (!value) throw new ValidationError('metadata title is too long to form a filesystem name');
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(value)) value = `_${value}`;
  return value;
}

function archiveSuffix(entryName: string): string {
  return entryName.match(/(\.part\d+\.rar|\.r\d{2,3})$/i)?.[1] ?? extname(entryName);
}

export function pathKey(path: string): string {
  const normalized = normalize(path);
  return process.platform === 'win32' || process.platform === 'darwin'
    ? normalized.toLocaleLowerCase()
    : normalized;
}

export function samePath(left: string, right: string): boolean {
  return pathKey(left) === pathKey(right);
}

export function targetPath(game: Game, format: string): string {
  const name = safeName(renderFilenameFormat(game, format));
  return join(dirname(game.entryPath), game.entryType === 'ARCHIVE' ? `${name}${archiveSuffix(game.entryName)}` : name);
}

async function createFileWithoutReplacing(source: string, destination: string): Promise<void> {
  try {
    await fs.link(source, destination);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') throw new ConflictError(`target already exists: ${basename(destination)}`);
    if (!['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'EXDEV'].includes(code ?? '')) throw err;
    await fs.copyFile(source, destination, fsConstants.COPYFILE_EXCL).catch((copyError: NodeJS.ErrnoException) => {
      if (copyError.code === 'EEXIST') throw new ConflictError(`target already exists: ${basename(destination)}`);
      throw copyError;
    });
  }
}

async function moveFileWithoutReplacing(source: string, destination: string): Promise<void> {
  await createFileWithoutReplacing(source, destination);
  try {
    await fs.unlink(source);
  } catch (err) {
    await fs.unlink(destination).catch(() => undefined);
    throw err;
  }
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
    if (samePath(newPath, game.entryPath)) return { oldPath: game.entryPath, newPath: game.entryPath };
    try {
      await fs.stat(newPath);
      throw new ConflictError(`target already exists: ${basename(newPath)}`);
    } catch (err) {
      if (err instanceof ConflictError) throw err;
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    if (game.entryType === 'ARCHIVE') {
      await moveFileWithoutReplacing(game.entryPath, newPath);
    } else {
      await fs.rename(game.entryPath, newPath);
    }
    return { oldPath: game.entryPath, newPath };
  },

  async rollback(oldPath: string, newPath: string, entryType: Game['entryType']): Promise<void> {
    if (entryType === 'ARCHIVE') {
      await moveFileWithoutReplacing(newPath, oldPath);
      return;
    }
    if (await filesystemRenameService.targetExists(oldPath)) {
      throw new ConflictError(`cannot restore original path: ${basename(oldPath)} already exists`);
    }
    await fs.rename(newPath, oldPath);
  },
};
