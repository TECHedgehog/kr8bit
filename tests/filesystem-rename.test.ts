import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import type { Game } from '../src/modules/library/library.types.js';
import { filesystemRenameService, pathKey, safeName, samePath, targetPath } from '../src/modules/library/filesystem-rename.service.js';

let root: string;

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1', entryPath: join(root, 'Original.7z'), entryType: 'ARCHIVE', entryName: 'Original.7z',
    originalEntryName: 'Original.7z', releaseVersion: null, releaseDlcs: [], releaseGroup: null,
    sizeBytes: 1, steamAppId: null, title: 'New Name', displayName: 'New Name', releaseYear: null,
    description: null, developers: [], publishers: [], genres: [], coverUrl: null, headerUrl: null,
    heroUrl: null, logoUrl: null, screenshots: [], videos: [], steamDeckCategory: null, steamDeckItems: [],
    matchStatus: 'PENDING', matchScore: null, matchedAt: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(async () => { root = await fs.mkdtemp(join(os.tmpdir(), 'kr8bit-rename-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe('filesystem rename', () => {
  it('preserves multipart archive suffixes', () => {
    const first = game({ entryName: 'Original.part1.rar', entryPath: join(root, 'Original.part1.rar') });
    const second = game({ entryName: 'Original.part2.rar', entryPath: join(root, 'Original.part2.rar') });
    expect(targetPath(first, '{title}')).toBe(join(root, 'New Name.part1.rar'));
    expect(targetPath(second, '{title}')).toBe(join(root, 'New Name.part2.rar'));
  });

  it('sanitizes reserved names and clamps output length', () => {
    expect(safeName('CON')).toBe('_CON');
    expect(Buffer.byteLength(safeName('é'.repeat(200)), 'utf8')).toBeLessThanOrEqual(200);
  });

  it('compares paths according to platform case behavior', () => {
    expect(samePath('/Games/Title.7z', '/Games/Title.7z')).toBe(true);
    expect(samePath('/Games/Title.7z', '/games/title.7z')).toBe(['win32', 'darwin'].includes(process.platform));
    expect(pathKey('/Games/Folder/../Title.7z')).toBe(pathKey('/Games/Title.7z'));
  });

  it('renames archive without replacing existing destination', async () => {
    const item = game();
    await fs.writeFile(item.entryPath, 'original');
    await fs.writeFile(join(root, 'New Name.7z'), 'keep');
    await expect(filesystemRenameService.rename(item, '{title}')).rejects.toThrow('target already exists');
    expect(await fs.readFile(join(root, 'New Name.7z'), 'utf8')).toBe('keep');
    expect(await fs.readFile(item.entryPath, 'utf8')).toBe('original');
  });

  it('moves archive contents and supports rollback', async () => {
    const item = game();
    await fs.writeFile(item.entryPath, 'payload');
    const moved = await filesystemRenameService.rename(item, '{title}');
    expect(await fs.readFile(moved.newPath, 'utf8')).toBe('payload');
    await filesystemRenameService.rollback(moved.oldPath, moved.newPath, item.entryType);
    expect(await fs.readFile(moved.oldPath, 'utf8')).toBe('payload');
    await expect(fs.stat(moved.newPath)).rejects.toThrow();
  });

  it('renames installer directories', async () => {
    const source = join(root, 'Original');
    const item = game({ entryType: 'DIRECTORY', entryName: 'Original', entryPath: source });
    await fs.mkdir(source);
    await fs.writeFile(join(source, 'setup.exe'), 'installer');
    const moved = await filesystemRenameService.rename(item, '{title}');
    expect(await fs.readFile(join(moved.newPath, 'setup.exe'), 'utf8')).toBe('installer');
  });
});
