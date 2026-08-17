import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchStatus } from '../src/shared/enums.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { providerRegistry } from '../src/modules/metadata/provider-registry.js';
import { normalizeGameName } from '../src/shared/normalize.js';
import { decideMatch } from '../src/modules/scanner/match-policy.js';
import { applyMatchResult } from '../src/modules/scanner/match-apply.js';
import { metadataRefreshJob } from '../src/modules/metadata/metadata-refresh.job.js';
import { RetryMatchJob } from '../src/modules/metadata/retry-match.job.js';

vi.mock('../src/modules/library/library.repository.js', () => ({
  libraryRepository: {
    findPendingGames: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../src/modules/metadata/provider-registry.js', () => ({
  providerRegistry: {
    order: vi.fn(),
  },
}));

vi.mock('../src/shared/normalize.js', () => ({
  normalizeGameName: vi.fn(),
}));

vi.mock('../src/modules/scanner/match-policy.js', () => ({
  decideMatch: vi.fn(),
}));

vi.mock('../src/modules/scanner/match-apply.js', () => ({
  applyMatchResult: vi.fn(),
}));

vi.mock('../src/modules/metadata/metadata-refresh.job.js', () => ({
  metadataRefreshJob: {
    isRunning: vi.fn(),
    start: vi.fn(),
  },
}));

function makeGame(id: string, entryName: string) {
  return { id, entryName } as unknown as Record<string, unknown>;
}

function makeProvider(name: string, results: unknown[]) {
  return { name, search: vi.fn().mockResolvedValue(results) };
}

function makeDecision(status: MatchStatus, score: number, result: unknown) {
  return { status, score, result } as unknown as { status: MatchStatus; score: number; result: unknown };
}

function makeJob(overrides: {
  now?: () => Date;
  delayMs?: number;
  concurrency?: number;
  sleep?: ReturnType<typeof vi.fn>;
  metadataRefresh?: ReturnType<typeof vi.fn>;
} = {}) {
  return new RetryMatchJob({
    now: overrides.now ?? (() => new Date('2024-08-01T00:00:00Z')),
    delayMs: overrides.delayMs ?? 0,
    concurrency: overrides.concurrency ?? 1,
    sleep: overrides.sleep ?? vi.fn(async () => undefined),
    metadataRefresh: {
      refresh: overrides.metadataRefresh ?? vi.fn(async () => undefined),
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(normalizeGameName).mockImplementation((name: string) => ({ query: name }));
  vi.mocked(providerRegistry.order).mockReturnValue([]);
  vi.mocked(metadataRefreshJob.isRunning).mockReturnValue(false);
});

describe('RetryMatchJob', () => {
  it('is not running initially', () => {
    const job = makeJob();
    expect(job.isRunning()).toBe(false);
  });

  it('is running during start and false after completion', async () => {
    const release = { resolve: (_games: unknown[]) => {} };
    const deferred = new Promise<unknown[]>((resolve) => {
      release.resolve = resolve;
    });
    vi.mocked(libraryRepository.findPendingGames).mockReturnValue(deferred as Promise<unknown[]>);

    const job = makeJob();
    const promise = job.start();
    expect(job.isRunning()).toBe(true);

    release.resolve([]);
    await promise;

    expect(job.isRunning()).toBe(false);
  });

  it('is no-op when already running', async () => {
    const release = { resolve: (_games: unknown[]) => {} };
    const deferred = new Promise<unknown[]>((resolve) => {
      release.resolve = resolve;
    });
    vi.mocked(libraryRepository.findPendingGames).mockReturnValue(deferred as Promise<unknown[]>);

    const job = makeJob();
    const first = job.start();
    const second = job.start();
    await second;

    expect(libraryRepository.findPendingGames).toHaveBeenCalledTimes(1);

    release.resolve([]);
    await first;
  });

  it('is no-op when no pending games', async () => {
    vi.mocked(libraryRepository.findPendingGames).mockResolvedValue([]);
    const job = makeJob();
    await job.start();

    expect(job.state()).toEqual({ running: false, processed: 0, failed: 0, succeeded: [], failedIds: [] });
    expect(metadataRefreshJob.start).not.toHaveBeenCalled();
  });

  it('searches all providers and accumulates results without early break', async () => {
    vi.mocked(libraryRepository.findPendingGames).mockResolvedValue([makeGame('1', 'Game')]);
    const providerA = makeProvider('steam', [
      { providerName: 'steam', remoteId: '10', title: 'Steam Game', score: 90 },
    ]);
    const providerB = makeProvider('igdb', [
      { providerName: 'igdb', remoteId: '20', title: 'Igdb Game', score: 80 },
    ]);
    vi.mocked(providerRegistry.order).mockReturnValue([providerA, providerB] as unknown as ReturnType<typeof providerRegistry.order>);
    vi.mocked(decideMatch).mockReturnValue(
      makeDecision(MatchStatus.ACCEPTED, 90, { providerName: 'steam', remoteId: '10', title: 'Steam Game' }),
    );
    vi.mocked(applyMatchResult).mockResolvedValue(true);

    const now = new Date('2024-08-01T00:00:00Z');
    const job = makeJob({ now: () => now });
    await job.start();

    expect(providerA.search).toHaveBeenCalledWith('Game');
    expect(providerB.search).toHaveBeenCalledWith('Game');
    expect(applyMatchResult).toHaveBeenCalledWith('1', expect.any(Object), now);
    expect(job.state()).toEqual({ running: false, processed: 1, failed: 0, succeeded: ['1'], failedIds: [] });
  });

  it('increments failed and updates status when applyMatchResult returns false', async () => {
    vi.mocked(libraryRepository.findPendingGames).mockResolvedValue([makeGame('1', 'Game')]);
    vi.mocked(providerRegistry.order).mockReturnValue([makeProvider('igdb', [])] as unknown as ReturnType<typeof providerRegistry.order>);
    const decision = makeDecision(MatchStatus.REJECTED, 30, { providerName: 'igdb', remoteId: '20', title: 'Igdb Game' });
    vi.mocked(decideMatch).mockReturnValue(decision);
    vi.mocked(applyMatchResult).mockResolvedValue(false);

    const now = new Date('2024-08-01T00:00:00Z');
    const job = makeJob({ now: () => now });
    await job.start();

    expect(applyMatchResult).toHaveBeenCalledWith('1', decision, now);
    expect(libraryRepository.update).toHaveBeenCalledWith('1', {
      matchStatus: MatchStatus.REJECTED,
      matchScore: 30,
      matchedAt: now,
    });
    expect(job.state()).toEqual({ running: false, processed: 0, failed: 1, succeeded: [], failedIds: ['1'] });
  });

  it('increments processed when applyMatchResult returns true', async () => {
    vi.mocked(libraryRepository.findPendingGames).mockResolvedValue([makeGame('1', 'Game')]);
    vi.mocked(providerRegistry.order).mockReturnValue([makeProvider('igdb', [])] as unknown as ReturnType<typeof providerRegistry.order>);
    vi.mocked(decideMatch).mockReturnValue(
      makeDecision(MatchStatus.ACCEPTED, 90, { providerName: 'igdb', remoteId: '20', title: 'Igdb Game' }),
    );
    vi.mocked(applyMatchResult).mockResolvedValue(true);

    const job = makeJob();
    await job.start();

    expect(job.state()).toEqual({ running: false, processed: 1, failed: 0, succeeded: ['1'], failedIds: [] });
  });

  it('triggers metadata refresh when processed > 0', async () => {
    vi.mocked(libraryRepository.findPendingGames).mockResolvedValue([makeGame('1', 'Game')]);
    vi.mocked(providerRegistry.order).mockReturnValue([makeProvider('igdb', [])] as unknown as ReturnType<typeof providerRegistry.order>);
    vi.mocked(decideMatch).mockReturnValue(
      makeDecision(MatchStatus.ACCEPTED, 90, { providerName: 'igdb', remoteId: '20', title: 'Igdb Game' }),
    );
    vi.mocked(applyMatchResult).mockResolvedValue(true);

    const job = makeJob();
    await job.start();

    expect(metadataRefreshJob.start).toHaveBeenCalledTimes(1);
  });

  it('eagerly refreshes metadata for ACCEPTED match', async () => {
    vi.mocked(libraryRepository.findPendingGames).mockResolvedValue([makeGame('1', 'Game')]);
    vi.mocked(providerRegistry.order).mockReturnValue([makeProvider('igdb', [])] as unknown as ReturnType<typeof providerRegistry.order>);
    vi.mocked(decideMatch).mockReturnValue(
      makeDecision(MatchStatus.ACCEPTED, 90, { providerName: 'igdb', remoteId: '20', title: 'Igdb Game' }),
    );
    vi.mocked(applyMatchResult).mockResolvedValue(true);

    const refresh = vi.fn().mockResolvedValue(undefined);
    await makeJob({ metadataRefresh: refresh }).start();

    expect(refresh).toHaveBeenCalledWith('1');
  });

  it('eagerly refreshes metadata for FLAGGED match', async () => {
    vi.mocked(libraryRepository.findPendingGames).mockResolvedValue([makeGame('1', 'Game')]);
    vi.mocked(providerRegistry.order).mockReturnValue([makeProvider('igdb', [])] as unknown as ReturnType<typeof providerRegistry.order>);
    vi.mocked(decideMatch).mockReturnValue(
      makeDecision(MatchStatus.FLAGGED, 75, { providerName: 'igdb', remoteId: '20', title: 'Igdb Game' }),
    );
    vi.mocked(applyMatchResult).mockResolvedValue(true);

    const refresh = vi.fn().mockResolvedValue(undefined);
    await makeJob({ metadataRefresh: refresh }).start();

    expect(refresh).toHaveBeenCalledWith('1');
  });

  it('does not eagerly refresh metadata for REJECTED match', async () => {
    vi.mocked(libraryRepository.findPendingGames).mockResolvedValue([makeGame('1', 'Game')]);
    vi.mocked(providerRegistry.order).mockReturnValue([makeProvider('igdb', [])] as unknown as ReturnType<typeof providerRegistry.order>);
    vi.mocked(decideMatch).mockReturnValue(
      makeDecision(MatchStatus.REJECTED, 50, { providerName: 'igdb', remoteId: '20', title: 'Igdb Game' }),
    );
    vi.mocked(applyMatchResult).mockResolvedValue(true);

    const refresh = vi.fn().mockResolvedValue(undefined);
    await makeJob({ metadataRefresh: refresh }).start();

    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not trigger metadata refresh when processed === 0', async () => {
    vi.mocked(libraryRepository.findPendingGames).mockResolvedValue([makeGame('1', 'Game')]);
    vi.mocked(providerRegistry.order).mockReturnValue([makeProvider('igdb', [])] as unknown as ReturnType<typeof providerRegistry.order>);
    vi.mocked(decideMatch).mockReturnValue(makeDecision(MatchStatus.PENDING, 0, null));
    vi.mocked(applyMatchResult).mockResolvedValue(false);

    const job = makeJob();
    await job.start();

    expect(metadataRefreshJob.start).not.toHaveBeenCalled();
  });

  it('state returns correct counts', async () => {
    vi.mocked(libraryRepository.findPendingGames).mockResolvedValue([
      makeGame('1', 'A'),
      makeGame('2', 'B'),
    ]);
    vi.mocked(providerRegistry.order).mockReturnValue([makeProvider('igdb', [])] as unknown as ReturnType<typeof providerRegistry.order>);
    vi.mocked(decideMatch)
      .mockReturnValueOnce(makeDecision(MatchStatus.ACCEPTED, 90, { providerName: 'igdb', remoteId: '1', title: 'A' }))
      .mockReturnValueOnce(makeDecision(MatchStatus.PENDING, 0, null));
    vi.mocked(applyMatchResult)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const job = makeJob();
    await job.start();

    expect(job.state()).toEqual({ running: false, processed: 1, failed: 1, succeeded: ['1'], failedIds: ['2'] });
  });

  it('sleeps between chunks except after the last', async () => {
    vi.mocked(libraryRepository.findPendingGames).mockResolvedValue([
      makeGame('1', 'A'),
      makeGame('2', 'B'),
      makeGame('3', 'C'),
    ]);
    vi.mocked(providerRegistry.order).mockReturnValue([makeProvider('igdb', [])] as unknown as ReturnType<typeof providerRegistry.order>);
    vi.mocked(decideMatch).mockReturnValue(makeDecision(MatchStatus.PENDING, 0, null));
    vi.mocked(applyMatchResult).mockResolvedValue(false);

    const sleep = vi.fn(async () => undefined);
    const job = makeJob({ delayMs: 75, concurrency: 2, sleep });
    await job.start();

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(75);
  });
});
