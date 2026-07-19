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

const SEVEN_Z_EXT = '.7z';
const SETUP_EXE = 'setup.exe';

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

async function hasSetupExe(dirPath: string, reader: DirectoryReader): Promise<boolean> {
  let entries: readonly string[];
  try {
    entries = await reader.readdir(dirPath);
  } catch (err) {
    logger.debug({ dirPath, err: (err as Error).message }, 'scanner: cannot read dir contents');
    return false;
  }
  return entries.some((name) => name.toLowerCase() === SETUP_EXE);
}

export async function scanLibraryRoot(
  rootPath: string,
  reader: DirectoryReader = fsReader,
): Promise<ScanCandidate[]> {
  const candidates: ScanCandidate[] = [];
  let entries: readonly string[];

  try {
    entries = await reader.readdir(rootPath);
  } catch (err) {
    logger.error({ rootPath, err: (err as Error).message }, 'scanner: cannot read library root');
    throw new Error(`cannot read library root: ${rootPath}`);
  }

  for (const name of entries) {
    const fullPath = join(rootPath, name);

    let stat;
    try {
      stat = await reader.stat(fullPath);
    } catch (err) {
      logger.debug({ fullPath, err: (err as Error).message }, 'scanner: stat failed');
      continue;
    }

    if (stat.isDirectory()) {
      const hasInstaller = await hasSetupExe(fullPath, reader);
      if (!hasInstaller) {
        logger.debug({ fullPath }, 'scanner: skipping dir without setup.exe');
        continue;
      }
      candidates.push({
        entryPath: fullPath,
        entryType: 'DIRECTORY' as EntryType,
        entryName: name,
        sizeBytes: stat.size,
      });
      continue;
    }

    if (stat.isFile() && name.toLowerCase().endsWith(SEVEN_Z_EXT)) {
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

  logger.info({ rootPath, count: candidates.length }, 'scanner: walk complete');
  return candidates;
}