import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, RetryableHttpError } from '../src/shared/http-retry.js';

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
    const fn = vi.fn().mockRejectedValue(new RetryableHttpError('boom'));
    const spy = vi.spyOn(global, 'setTimeout');
    const promise = withRetry(fn, { retries: 1, baseDelayMs: 1000 }).catch((err) => err);
    await vi.advanceTimersByTimeAsync(5000);
    const err = await promise;
    expect(err).toBeInstanceOf(RetryableHttpError);

    const delays = spy.mock.calls.map((args) => args[1] as number);
    expect(delays.length).toBeGreaterThanOrEqual(1);
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThan(1000 * 1.3 + 1);
    }
    spy.mockRestore();
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
