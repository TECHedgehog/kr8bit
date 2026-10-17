import { samePath, pathKey, targetPath } from './filesystem-rename.service.js';
import type { Game, GameRenamePreview, GameRenameResult } from './library.types.js';

interface RenameRepository {
  findById(id: string): Promise<Game>;
  listAll(): Promise<Game[]>;
  updateEntry(id: string, entryPath: string, entryName: string): Promise<Game>;
}

interface RenameFilesystem {
  rename(game: Game, format: string): Promise<{ oldPath: string; newPath: string }>;
  rollback(oldPath: string, newPath: string, entryType: Game['entryType']): Promise<void>;
  targetExists(path: string): Promise<boolean>;
}

interface RenameServiceDependencies {
  repository: RenameRepository;
  filesystem: RenameFilesystem;
  resolveFormat(override?: string): Promise<string>;
}

export function createRenameService({ repository, filesystem, resolveFormat }: RenameServiceDependencies) {
  return {
    async rename(ids: string[], formatOverride?: string): Promise<GameRenameResult[]> {
      const format = await resolveFormat(formatOverride);
      const results: GameRenameResult[] = [];
      for (const id of [...new Set(ids)]) {
        let game: Game | undefined;
        let moved: { oldPath: string; newPath: string } | undefined;
        try {
          game = await repository.findById(id);
          const paths = await filesystem.rename(game, format);
          moved = paths;
          if (samePath(paths.oldPath, paths.newPath)) {
            results.push({ id, oldPath: paths.oldPath, newPath: paths.newPath, status: 'skipped', message: 'already named' });
            continue;
          }
          await repository.updateEntry(id, paths.newPath, paths.newPath.split(/[\\/]/).pop() ?? game.entryName);
          results.push({ id, ...paths, status: 'renamed' });
        } catch (err) {
          let message = (err as Error).message;
          if (game && moved && !samePath(moved.oldPath, moved.newPath)) {
            try {
              await filesystem.rollback(moved.oldPath, moved.newPath, game.entryType);
            } catch (rollbackError) {
              message += `; rollback failed: ${(rollbackError as Error).message}`;
            }
          }
          results.push({ id, oldPath: game?.entryPath ?? '', newPath: null, status: 'failed', message });
        }
      }
      return results;
    },

    async previewRename(formatOverride?: string): Promise<GameRenamePreview[]> {
      const format = await resolveFormat(formatOverride);
      const games = await repository.listAll();
      const proposed: Array<{ item: GameRenamePreview; path?: string }> = [];
      for (const game of games) {
        if (!game.title?.trim()) {
          proposed.push({ item: { id: game.id, oldName: game.entryName, newName: null, status: 'unavailable', message: 'missing metadata title' } });
          continue;
        }
        try {
          const newPath = targetPath(game, format);
          const newName = newPath.split(/[\\/]/).pop() ?? newPath;
          if (samePath(newPath, game.entryPath)) {
            proposed.push({ path: newPath, item: { id: game.id, oldName: game.entryName, newName, status: 'unchanged', message: 'already named' } });
          } else if (await filesystem.targetExists(newPath)) {
            proposed.push({ path: newPath, item: { id: game.id, oldName: game.entryName, newName, status: 'conflict', message: 'target already exists' } });
          } else {
            proposed.push({ path: newPath, item: { id: game.id, oldName: game.entryName, newName, status: 'ready' } });
          }
        } catch (err) {
          proposed.push({ item: { id: game.id, oldName: game.entryName, newName: null, status: 'unavailable', message: (err as Error).message } });
        }
      }
      const destinations = new Map<string, number[]>();
      for (const [index, entry] of proposed.entries()) {
        if (!entry.path || entry.item.status !== 'ready') continue;
        const key = pathKey(entry.path);
        destinations.set(key, [...(destinations.get(key) ?? []), index]);
      }
      for (const indexes of destinations.values()) {
        if (indexes.length < 2) continue;
        for (const index of indexes) {
          proposed[index].item.status = 'conflict';
          proposed[index].item.message = 'multiple games target same path';
        }
      }
      return proposed.map(({ item }) => item);
    },
  };
}
