import { describe, it, expect, vi, beforeEach } from 'vitest';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { metadataService } from '../src/modules/metadata/metadata.service.js';
import { MetadataRefreshJob } from '../src/modules/metadata/metadata-refresh.job.js';

vi.mock('../src/modules/library/library.repository.js', () => ({
  libraryRepository: {
    findEligibleForRefresh: vi.fn(),
  },
}));

vi.mock('../src/modules/metadata/metadata.service.js', () => ({
  metadataService: {
    refresh: vi.fn(),
  },
}));

function makeGame(id: string) {
  return { id, entryName: `Game ${id}` } as unknown as Record<string, unknown>;
}

function makeJob(overrides: { delayMs?: number; concurrency?: number; sleep?: ReturnType<typeof vi.fn> } = {}) {
  return new MetadataRefreshJob({
    delayMs: overrides.delayMs ?? 0,
    concurrency: overrides.concurrency ?? 1,
    sleep: overrides.sleep ?? vi.fn(async () => undefined),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MetadataRefreshJob', () => {
  it('is not running initially', () => {
    const job = makeJob();
    expect(job.isRunning()).toBe(false);
  });

  it('is running during start and false after completion', async () => {
    const release = { resolve: (_games: unknown[]) => {} };
    const deferred = new Promise<unknown[]>((resolve) => {
      release.resolve = resolve;
    });
    vi.mocked(libraryRepository.findEligibleForRefresh).mockReturnValue(deferred as Promise<unknown[]>);
    vi.mocked(metadataService.refresh).mockResolvedValue(true);

    const job = makeJob();
    const promise = job.start();
    expect(job.isRunning()).toBe(true);

    release.resolve([makeGame('1')]);
    await promise;

    expect(job.isRunning()).toBe(false);
    expect(metadataService.refresh).toHaveBeenCalledWith('1');
  });

  it('is no-op when already running', async () => {
    const release = { resolve: (_games: unknown[]) => {} };
    const deferred = new Promise<unknown[]>((resolve) => {
      release.resolve = resolve;
    });
    vi.mocked(libraryRepository.findEligibleForRefresh).mockReturnValue(deferred as Promise<unknown[]>);

    const job = makeJob();
    const first = job.start();
    const second = job.start();
    await second;

    expect(libraryRepository.findEligibleForRefresh).toHaveBeenCalledTimes(1);

    release.resolve([]);
    await first;
  });

  it('is no-op when no eligible games', async () => {
    vi.mocked(libraryRepository.findEligibleForRefresh).mockResolvedValue([]);
    const job = makeJob();
    await job.start();

    expect(metadataService.refresh).not.toHaveBeenCalled();
    expect(job.state()).toEqual({ running: false, processed: 0, failed: 0, succeeded: [], failedIds: [] });
  });

  it('refreshes each eligible game and counts processed', async () => {
    vi.mocked(libraryRepository.findEligibleForRefresh).mockResolvedValue([
      makeGame('1'),
      makeGame('2'),
    ]);
    vi.mocked(metadataService.refresh).mockResolvedValue(true);

    const job = makeJob();
    await job.start();

    expect(metadataService.refresh).toHaveBeenCalledTimes(2);
    expect(metadataService.refresh).toHaveBeenNthCalledWith(1, '1');
    expect(metadataService.refresh).toHaveBeenNthCalledWith(2, '2');
    expect(job.state()).toEqual({ running: false, processed: 2, failed: 0, succeeded: ['1', '2'], failedIds: [] });
  });

  it('increments failed when refresh throws and continues', async () => {
    vi.mocked(libraryRepository.findEligibleForRefresh).mockResolvedValue([
      makeGame('1'),
      makeGame('2'),
      makeGame('3'),
    ]);
    vi.mocked(metadataService.refresh)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(true);

    const job = makeJob();
    await job.start();

    expect(job.state()).toEqual({ running: false, processed: 1, failed: 2, succeeded: ['3'], failedIds: ['1', '2'] });
  });

  it('increments failed when refresh returns null', async () => {
    vi.mocked(libraryRepository.findEligibleForRefresh).mockResolvedValue([makeGame('1')]);
    vi.mocked(metadataService.refresh).mockResolvedValue(null as unknown as boolean);

    const job = makeJob();
    await job.start();

    expect(job.state()).toEqual({ running: false, processed: 0, failed: 1, succeeded: [], failedIds: ['1'] });
  });

  it('sleeps between chunks except after the last', async () => {
    vi.mocked(libraryRepository.findEligibleForRefresh).mockResolvedValue([
      makeGame('1'),
      makeGame('2'),
      makeGame('3'),
    ]);
    vi.mocked(metadataService.refresh).mockResolvedValue(true);

    const sleep = vi.fn(async () => undefined);
    const job = makeJob({ delayMs: 50, concurrency: 2, sleep });
    await job.start();

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(50);
  });
});
