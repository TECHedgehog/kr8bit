import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../../logger/index.js';
import type { EntryType } from '../../shared/enums.js';

export interface ScanCandidate {
  entryPath: string;
  entryType: EntryType;
  entryName: string;
  sizeBytes: number;
}

export interface ScanOptions {
  maxDepth?: number;
  extensions?: string[];
  installerNames?: string[];
  skipDirs?: string[];
}

export const DEFAULT_SCAN_OPTIONS: Required<ScanOptions> = {
  maxDepth: 1,
  extensions: ['.7z'],
  installerNames: ['setup.exe'],
  skipDirs: ['.git', 'node_modules', '.DS_Store'],
};

export interface DirectoryReader {
  readdir(path: string): Promise<readonly string[]>;
  stat(path: string): Promise<{ size: number; isDirectory(): boolean; isFile(): boolean }>;
}

export const fsReader: DirectoryReader = {
  async readdir(path) {
    return fs.readdir(path);
  },
  async stat(path) {
    return fs.stat(path);
  },
};

async function hasInstaller(dirPath: string, installerNames: Set<string>, reader: DirectoryReader): Promise<boolean> {
  let entries: readonly string[];
  try {
    entries = await reader.readdir(dirPath);
  } catch (err) {
    logger.debug({ dirPath, err: (err as Error).message }, 'scanner: cannot read dir contents');
    return false;
  }
  return entries.some((name) => installerNames.has(name.toLowerCase()));
}

export async function scanLibraryRoot(
  rootPath: string,
  reader: DirectoryReader = fsReader,
  options: ScanOptions = {},
): Promise<ScanCandidate[]> {
  const maxDepth = options.maxDepth ?? DEFAULT_SCAN_OPTIONS.maxDepth;
  const extensions = new Set(options.extensions ?? DEFAULT_SCAN_OPTIONS.extensions);
  const installerNames = new Set(options.installerNames ?? DEFAULT_SCAN_OPTIONS.installerNames);
  const skipDirs = new Set(options.skipDirs ?? DEFAULT_SCAN_OPTIONS.skipDirs);

  const candidates: ScanCandidate[] = [];

  async function walk(dirPath: string, depth: number): Promise<void> {
    let entries: readonly string[];
    try {
      entries = await reader.readdir(dirPath);
    } catch (err) {
      if (depth === 0) {
        logger.error({ rootPath: dirPath, err: (err as Error).message }, 'scanner: cannot read library root');
        throw new Error(`cannot read library root: ${dirPath}`);
      }
      logger.debug({ dirPath, err: (err as Error).message }, 'scanner: cannot read dir contents');
      return;
    }

    for (const name of entries) {
      if (skipDirs.has(name)) {
        continue;
      }

      const fullPath = join(dirPath, name);

      let stat;
      try {
        stat = await reader.stat(fullPath);
      } catch (err) {
        logger.debug({ fullPath, err: (err as Error).message }, 'scanner: stat failed');
        continue;
      }

      if (stat.isDirectory()) {
        const hasInstallerFile = await hasInstaller(fullPath, installerNames, reader);
        if (hasInstallerFile) {
          candidates.push({
            entryPath: fullPath,
            entryType: 'DIRECTORY' as EntryType,
            entryName: name,
            sizeBytes: stat.size,
          });
        } else if (depth + 1 < maxDepth) {
          await walk(fullPath, depth + 1);
        } else {
          logger.debug({ fullPath }, 'scanner: skipping dir without installer');
        }
        continue;
      }

      const lastDot = name.lastIndexOf('.');
      const ext = lastDot > 0 ? name.slice(lastDot).toLowerCase() : '';
      if (stat.isFile() && extensions.has(ext)) {
        candidates.push({
          entryPath: fullPath,
          entryType: 'ARCHIVE' as EntryType,
          entryName: name,
          sizeBytes: stat.size,
        });
        continue;
      }

      logger.debug({ fullPath }, 'scanner: skipping unrecognized entry');
    }
  }

  await walk(rootPath, 0);

  logger.info({ rootPath, count: candidates.length }, 'scanner: walk complete');
  return candidates;
}