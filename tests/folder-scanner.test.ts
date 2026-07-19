import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { scanLibraryRoot } from '../src/modules/scanner/folder-scanner.js';

const tmpBase = join(os.tmpdir(), 'kr8bit-scanner-');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(tmpBase);
});
afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function write(path: string, contents = 'x'): Promise<void> {
  await fs.writeFile(path, contents);
}

function entryByName(cands: Awaited<ReturnType<typeof scanLibraryRoot>>, name: string) {
  return cands.find((c) => c.entryName === name);
}

describe('folder-scanner', () => {
  it('detects .7z files at root', async () => {
    await write(join(tmpDir, 'Game One.7z'));
    await write(join(tmpDir, 'readme.txt'));
    const result = await scanLibraryRoot(tmpDir);

    expect(result).toHaveLength(1);
    expect(result[0].entryType).toBe('ARCHIVE');
    expect(result[0].entryName).toBe('Game One.7z');
    expect(result[0].entryPath).toBe(join(tmpDir, 'Game One.7z'));
    expect(result[0].sizeBytes).toBeGreaterThan(0);
  });

  it('detects directories containing setup.exe (case-insensitive)', async () => {
    await fs.mkdir(join(tmpDir, 'Skyrim'));
    await write(join(tmpDir, 'Skyrim', 'Setup.EXE'));
    await fs.mkdir(join(tmpDir, 'Empty Dir'));

    const result = await scanLibraryRoot(tmpDir);

    expect(result).toHaveLength(1);
    expect(result[0].entryType).toBe('DIRECTORY');
    expect(result[0].entryName).toBe('Skyrim');
    expect(result[0].entryPath).toBe(join(tmpDir, 'Skyrim'));
  });

  it('skips directories without setup.exe', async () => {
    await fs.mkdir(join(tmpDir, 'No Installer'));
    await write(join(tmpDir, 'No Installer', 'game.exe'));

    const result = await scanLibraryRoot(tmpDir);
    expect(result).toHaveLength(0);
  });

  it('skips non-.7z files', async () => {
    await write(join(tmpDir, 'a.rar'));
    await write(join(tmpDir, 'b.zip'));
    await write(join(tmpDir, 'c.iso'));
    await write(join(tmpDir, 'd.exe'));

    const result = await scanLibraryRoot(tmpDir);
    expect(result).toHaveLength(0);
  });

  it('handles mixed entries', async () => {
    await write(join(tmpDir, 'Archive.7z'));
    await fs.mkdir(join(tmpDir, 'UnpackedGame'));
    await write(join(tmpDir, 'UnpackedGame', 'setup.exe'));
    await write(join(tmpDir, 'skip.zip'));
    await fs.mkdir(join(tmpDir, 'no-installer'));
    await write(join(tmpDir, 'no-installer', 'readme.txt'));

    const result = await scanLibraryRoot(tmpDir);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.entryType).sort()).toEqual(['ARCHIVE', 'DIRECTORY']);
  });

  it('throws when library root does not exist', async () => {
    await expect(scanLibraryRoot(join(tmpDir, 'does-not-exist'))).rejects.toThrow(
      /cannot read library root/,
    );
  });
});