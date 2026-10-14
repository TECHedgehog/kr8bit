import { describe, expect, it, vi } from 'vitest';
import { SourceBlockedError, SourceHttpClient } from '../src/modules/repack-catalog/source-http-client.js';

describe('SourceHttpClient', () => {
  it('caches validators and serves cached content after 304', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('<html>page</html>', { headers: { etag: 'tag-1' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const client = new SourceHttpClient({ minDelayMs: 0, maxDelayMs: 0, sleep: async () => undefined, fetchImpl });

    await expect(client.get('https://fitgirl.test/')).resolves.toEqual({ html: '<html>page</html>', unchanged: false });
    await expect(client.get('https://fitgirl.test/')).resolves.toEqual({ html: '<html>page</html>', unchanged: true });
    expect(fetchImpl.mock.calls[1][1]?.headers).toMatchObject({ 'if-none-match': 'tag-1' });
  });

  it('honors Retry-After for a rate-limited response', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '3' } }))
      .mockResolvedValueOnce(new Response('recovered'));
    const client = new SourceHttpClient({ minDelayMs: 0, maxDelayMs: 0, maxRetries: 1, sleep, fetchImpl });

    await expect(client.get('https://fitgirl.test/')).resolves.toMatchObject({ html: 'recovered' });
    expect(sleep).toHaveBeenCalledWith(3_000);
  });

  it('stops immediately when the server denies access', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
    const client = new SourceHttpClient({ minDelayMs: 0, maxDelayMs: 0, sleep: async () => undefined, fetchImpl });
    await expect(client.get('https://fitgirl.test/')).rejects.toBeInstanceOf(SourceBlockedError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
