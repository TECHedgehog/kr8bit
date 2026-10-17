import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../src/modules/library/library.types.js';
import { createRenameService } from '../src/modules/library/rename.service.js';
import { targetPath } from '../src/modules/library/filesystem-rename.service.js';

function game(id: string, entryName: string, title: string | null = 'Target'): Game {
  return {
    id,
    entryPath: `/games/${entryName}`,
    entryType: 'ARCHIVE',
    entryName,
    originalEntryName: entryName,
    releaseVersion: null,
    releaseDlcs: [],
    releaseGroup: null,
    sizeBytes: 1,
    steamAppId: null,
    title,
    displayName: title ?? entryName,
    releaseYear: null,
    description: null,
    developers: [],
    publishers: [],
    genres: [],
    coverUrl: null,
    headerUrl: null,
    heroUrl: null,
    logoUrl: null,
    screenshots: [],
    videos: [],
    steamDeckCategory: null,
    steamDeckItems: [],
    matchStatus: 'PENDING',
    matchScore: null,
    matchedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function setup(games: Game[]) {
  const repository = {
    findById: vi.fn(async (id: string) => {
      const found = games.find((item) => item.id === id);
      if (!found) throw new Error(`missing game: ${id}`);
      return found;
    }),
    listAll: vi.fn(async () => games),
    updateEntry: vi.fn(async () => games[0]),
  };
  const filesystem = {
    rename: vi.fn(async (item: Game, format: string) => ({ oldPath: item.entryPath, newPath: targetPath(item, format) })),
    rollback: vi.fn(async () => undefined),
    targetExists: vi.fn(async () => false),
  };
  const service = createRenameService({
    repository,
    filesystem,
    resolveFormat: async (override) => override ?? '{title}',
  });
  return { service, repository, filesystem };
}

describe('rename service', () => {
  it('rolls filesystem move back when database update fails', async () => {
    const item = game('one', 'Source.7z');
    const { service, repository, filesystem } = setup([item]);
    repository.updateEntry.mockRejectedValueOnce(new Error('database unavailable'));

    const [result] = await service.rename([item.id]);

    expect(result).toMatchObject({ status: 'failed', message: 'database unavailable', oldPath: item.entryPath });
    expect(filesystem.rollback).toHaveBeenCalledWith(item.entryPath, '/games/Target.7z', item.entryType);
  });

  it('merges rollback failure into database failure message', async () => {
    const item = game('one', 'Source.7z');
    const { service, repository, filesystem } = setup([item]);
    repository.updateEntry.mockRejectedValueOnce(new Error('database unavailable'));
    filesystem.rollback.mockRejectedValueOnce(new Error('restore denied'));

    const [result] = await service.rename([item.id]);

    expect(result).toMatchObject({ status: 'failed', message: 'database unavailable; rollback failed: restore denied' });
  });

  it('marks every game with colliding destination as conflict', async () => {
    const first = game('one', 'First.7z', 'Same Target');
    const second = game('two', 'Second.7z', 'Same Target');
    const { service } = setup([first, second]);

    const preview = await service.previewRename('{title}');

    expect(preview.map((item) => item.status)).toEqual(['conflict', 'conflict']);
    expect(preview.map((item) => item.message)).toEqual([
      'multiple games target same path',
      'multiple games target same path',
    ]);
  });

  it('skips rename when destination matches current path', async () => {
    const item = game('one', 'Target.7z');
    const { service, repository, filesystem } = setup([item]);

    const [result] = await service.rename([item.id]);

    expect(result).toMatchObject({ status: 'skipped', message: 'already named' });
    expect(repository.updateEntry).not.toHaveBeenCalled();
    expect(filesystem.rollback).not.toHaveBeenCalled();
  });

  it('reports missing IDs per item and continues batch', async () => {
    const item = game('known', 'Source.7z');
    const { service } = setup([item]);

    const results = await service.rename(['missing', item.id]);

    expect(results.map((result) => result.status)).toEqual(['failed', 'renamed']);
    expect(results[0]).toMatchObject({ id: 'missing', oldPath: '', newPath: null, message: 'missing game: missing' });
  });
});
