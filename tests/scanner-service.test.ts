import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../src/prisma-client.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { scannerRepository } from '../src/modules/scanner/scanner.repository.js';
import { ScannerService } from '../src/modules/scanner/scanner.service.js';
import { MatchStatus } from '../src/shared/enums.js';
import type { MetadataProvider, SearchResult } from '../src/shared/types.js';
import { onProgress } from '../src/modules/scanner/scanner.events.js';
import type { ScanProgressEvent } from '../src/modules/scanner/scanner.events.js';

const tmpBase = join(os.tmpdir(), 'kr8bit-scan-');
let tmpDir: string;

interface ScanStats {
  found: number;
  added: number;
  updated: number;
  failed: number;
}

function waitForScanComplete(scanRunId: string, timeoutMs = 5000): Promise<ScanStats> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      unsubscribe();
      reject(new Error(`scan timeout for ${scanRunId}`));
    }, timeoutMs);
    const unsubscribe = onProgress((event: ScanProgressEvent) => {
      if (event.scanRunId !== scanRunId) return;
      if (event.phase === 'done') {
        clearTimeout(to);
        unsubscribe();
        resolve({ found: event.found, added: event.added, updated: event.updated, failed: event.failed });
      }
    });
  });
}

function mockProvider(results: SearchResult[]): MetadataProvider {
  const fn = vi.fn(async () => results);
  return {
    name: 'mock',
    search: fn,
    getGame: vi.fn(),
    getImages: vi.fn(),
  } as unknown as MetadataProvider;
}

function mockQueryProvider(fn: (query: string) => SearchResult[]): MetadataProvider {
  return {
    name: 'mock',
    search: vi.fn(async (q: string) => fn(q)),
    getGame: vi.fn(),
    getImages: vi.fn(),
  } as unknown as MetadataProvider;
}

function makeReader() {
  return {
    async readdir(path: string) {
      return fs.readdir(path);
    },
    async stat(path: string) {
      return fs.stat(path);
    },
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(tmpBase);
  await prisma.game.deleteMany({});
  await prisma.scanRun.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('ScannerService.start', () => {
  it('creates games for new candidates and assigns match status', async () => {
    await fs.writeFile(join(tmpDir, 'Skyrim.7z'), 'data');
    await fs.writeFile(join(tmpDir, 'Random Junk.7z'), 'data');

    const provider = mockQueryProvider((query) => {
      if (query.toLowerCase().includes('skyrim')) {
        return [{ remoteId: '72850', title: 'The Elder Scrolls V: Skyrim', score: 95 }];
      }
      return [];
    });
    const service = new ScannerService({
      provider,
      reader: makeReader(),
      now: () => new Date('2024-06-01T00:00:00Z'),
      libraryRoot: tmpDir,
    });

    const run = await service.start();
    const stats = await waitForScanComplete(run.id);

    expect(stats.found).toBe(2);
    expect(stats.added).toBe(2);
    expect(stats.updated).toBe(0);
    expect(stats.failed).toBe(0);

    const all = await libraryRepository.list({ limit: 50 });
    expect(all.total).toBe(2);

    const skyrim = await libraryRepository.findByEntryPath(join(tmpDir, 'Skyrim.7z'));
    expect(skyrim).not.toBeNull();
    expect(skyrim?.matchStatus).toBe(MatchStatus.ACCEPTED);
    expect(skyrim?.steamAppId).toBe(72850);
    expect(skyrim?.matchScore).toBe(95);

    const junk = await libraryRepository.findByEntryPath(join(tmpDir, 'Random Junk.7z'));
    expect(junk?.matchStatus).toBe(MatchStatus.PENDING);
    expect(junk?.steamAppId).toBeNull();
  });

  it('skips ACCEPTED games on re-scan', async () => {
    await fs.writeFile(join(tmpDir, 'Skyrim.7z'), 'data');
    const provider = mockProvider([
      { remoteId: '72850', title: 'The Elder Scrolls V: Skyrim', score: 95 },
    ]);
    const deps = {
      provider,
      reader: makeReader(),
      now: () => new Date('2024-06-01T00:00:00Z'),
      libraryRoot: tmpDir,
    };
    const service = new ScannerService(deps);

    const run1 = await service.start();
    const stats1 = await waitForScanComplete(run1.id);
    expect(stats1.added).toBe(1);

    const firstCount = (await libraryRepository.list({ limit: 100 })).total;
    expect(firstCount).toBe(1);

    const run2 = await service.start();
    const stats2 = await waitForScanComplete(run2.id);
    expect(stats2.added).toBe(0);
    expect(stats2.updated).toBe(0);

    expect((await libraryRepository.list({ limit: 100 })).total).toBe(1);
  });

  it('re-matches FLAGGED games on re-scan', async () => {
    await fs.writeFile(join(tmpDir, 'Skyr.7z'), 'data');

    let callCount = 0;
    const provider: MetadataProvider = {
      name: 'mock',
      search: vi.fn(async (): Promise<SearchResult[]> => {
        callCount += 1;
        return callCount === 1
          ? [{ remoteId: '7', title: 'Skyrim', score: 75 }]
          : [{ remoteId: '72850', title: 'The Elder Scrolls V: Skyrim', score: 95 }];
      }),
      getGame: vi.fn(),
      getImages: vi.fn(),
    } as unknown as MetadataProvider;

    const deps = {
      provider,
      reader: makeReader(),
      now: () => new Date('2024-06-01T00:00:00Z'),
      libraryRoot: tmpDir,
    };
    const service = new ScannerService(deps);

    const run1 = await service.start();
    await waitForScanComplete(run1.id);
    let game = await libraryRepository.findByEntryPath(join(tmpDir, 'Skyr.7z'));
    expect(game?.matchStatus).toBe(MatchStatus.FLAGGED);
    expect(game?.steamAppId).toBe(7);

    const run2 = await service.start();
    await waitForScanComplete(run2.id);
    game = await libraryRepository.findByEntryPath(join(tmpDir, 'Skyr.7z'));
    expect(game?.matchStatus).toBe(MatchStatus.ACCEPTED);
    expect(game?.steamAppId).toBe(72850);
  });

  it('preserves existing steamAppId when re-scan returns empty results', async () => {
    await fs.writeFile(join(tmpDir, 'Skyrim.7z'), 'data');

    const provider: MetadataProvider = {
      name: 'mock',
      search: vi.fn(async (): Promise<SearchResult[]> => [{ remoteId: '7', title: 'Skyrim', score: 75 }]),
      getGame: vi.fn(),
      getImages: vi.fn(),
    } as unknown as MetadataProvider;

    const service = new ScannerService({
      provider,
      reader: makeReader(),
      now: () => new Date('2024-06-01T00:00:00Z'),
      libraryRoot: tmpDir,
    });

    const run1 = await service.start();
    await waitForScanComplete(run1.id);
    const after1 = await libraryRepository.findByEntryPath(join(tmpDir, 'Skyrim.7z'));
    expect(after1?.steamAppId).toBe(7);

    (provider.search as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const run2 = await service.start();
    await waitForScanComplete(run2.id);
    const after2 = await libraryRepository.findByEntryPath(join(tmpDir, 'Skyrim.7z'));
    expect(after2?.steamAppId).toBe(7);
    expect(after2?.matchStatus).toBe(MatchStatus.FLAGGED);
  });

  it('records scan run with stats', async () => {
    await fs.writeFile(join(tmpDir, 'Game.7z'), 'data');
    const service = new ScannerService({
      provider: mockProvider([{ remoteId: '1', title: 'Game', score: 95 }]),
      reader: makeReader(),
      now: () => new Date('2024-06-01T00:00:00Z'),
      libraryRoot: tmpDir,
    });

    const run = await service.start();
    await waitForScanComplete(run.id);

    const refreshed = await scannerRepository.findById(run.id);
    expect(refreshed.status).toBe('DONE');
    expect(refreshed.found).toBe(1);
    expect(refreshed.added).toBe(1);
    expect(refreshed.failed).toBe(0);
    expect(refreshed.finishedAt).not.toBeNull();
    expect(refreshed.errors).toEqual([]);
  });

  it('prevents concurrent runs', async () => {
    await fs.writeFile(join(tmpDir, 'Game.7z'), 'data');
    const service = new ScannerService({
      provider: mockProvider([{ remoteId: '1', title: 'Game', score: 95 }]),
      reader: makeReader(),
      now: () => new Date('2024-06-01T00:00:00Z'),
      libraryRoot: tmpDir,
    });

    const run1 = await service.start();
    await expect(service.start()).rejects.toThrow('scan already running');
    await waitForScanComplete(run1.id);
  });

  it('detects DIRECTORY entries with setup.exe', async () => {
    await fs.mkdir(join(tmpDir, 'Some Game'));
    await fs.writeFile(join(tmpDir, 'Some Game', 'setup.exe'), 'binary');

    const service = new ScannerService({
      provider: mockProvider([{ remoteId: '42', title: 'Some Game', score: 92 }]),
      reader: makeReader(),
      now: () => new Date('2024-06-01T00:00:00Z'),
      libraryRoot: tmpDir,
    });

    const run = await service.start();
    const stats = await waitForScanComplete(run.id);
    expect(stats.found).toBe(1);
    const game = await libraryRepository.findByEntryPath(join(tmpDir, 'Some Game'));
    expect(game?.entryType).toBe('DIRECTORY');
    expect(game?.matchStatus).toBe(MatchStatus.ACCEPTED);
  });
});