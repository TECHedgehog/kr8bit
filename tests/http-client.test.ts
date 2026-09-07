import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  RetryableHttpError,
  isRetryableStatus,
  urlWithoutQuery,
  USER_AGENT,
} from '../src/shared/http-client.js';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('succeeds without retry when fn works', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { retries: 3, baseDelayMs: 100 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on RetryableHttpError and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RetryableHttpError('boom'))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, { retries: 3, baseDelayMs: 100 });
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on plain Error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(withRetry(fn, { retries: 3, baseDelayMs: 100 })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableHttpError('boom'));
    const promise = withRetry(fn, { retries: 2, baseDelayMs: 10 }).catch((err) => err);
    await vi.advanceTimersByTimeAsync(1000);
    const err = await promise;
    expect(err).toBeInstanceOf(RetryableHttpError);
    expect((err as Error).message).toBe('boom');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('increases delay exponentially', async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableHttpError('boom'));
    const promise = withRetry(fn, { retries: 3, baseDelayMs: 100 }).catch((err) => err);

    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(400);
    expect(fn).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(800);
    expect(fn).toHaveBeenCalledTimes(4);

    const err = await promise;
    expect(err).toBeInstanceOf(RetryableHttpError);
  });

  it('applies jitter within expected range', async () => {
    // Jitter is 0-30% of baseDelayMs, so the retry delay lies in
    // [baseDelayMs, baseDelayMs * 1.3). Verified by advancing the fake
    // clock: no retry before baseDelayMs, retry guaranteed by 1.3x.
    // (Do not spy on global setTimeout here — spying on a global while
    // fake timers are installed corrupts the timer restore and hangs
    // later prisma $disconnect calls in this shared-fork test process.)
    const fn = vi.fn().mockRejectedValue(new RetryableHttpError('boom'));
    const promise = withRetry(fn, { retries: 1, baseDelayMs: 1000 }).catch((err) => err);

    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(301);
    expect(fn).toHaveBeenCalledTimes(2);

    const err = await promise;
    expect(err).toBeInstanceOf(RetryableHttpError);
  });

  it('respects custom retryOn predicate', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('retry-me'))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, {
      retries: 3,
      baseDelayMs: 100,
      retryOn: (err) => err.message === 'retry-me',
    });
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('isRetryableStatus', () => {
  it('retries 429 and 5xx only', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(302)).toBe(false);
  });
});

describe('urlWithoutQuery', () => {
  it('strips query and fragment (secrets never reach logs)', () => {
    expect(urlWithoutQuery('https://api.steampowered.com/ISteamApps/GetAppList/v2?key=SECRET'))
      .toBe('https://api.steampowered.com/ISteamApps/GetAppList/v2');
    expect(urlWithoutQuery('https://x/cover.jpg?t=1&v=2#frag'))
      .toBe('https://x/cover.jpg');
  });

  it('returns input unchanged for invalid URLs', () => {
    expect(urlWithoutQuery('not a url')).toBe('not a url');
  });
});

describe('USER_AGENT', () => {
  it('derives from package.json version', () => {
    expect(USER_AGENT).toMatch(/^kr8bit\/\d+\.\d+\.\d+$/);
  });
});
