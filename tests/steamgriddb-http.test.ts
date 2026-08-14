import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { request } from 'undici';
import { SteamGridDbHttpClientImpl } from '../src/modules/artwork/steamgriddb/steamgriddb.http.js';
import type { SteamGridDbImage, SteamGridDbImageResponse } from '../src/modules/artwork/steamgriddb/steamgriddb.http.types.js';

vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>();
  return {
    ...actual,
    request: vi.fn(),
  };
});

function makeImage(opts: Partial<SteamGridDbImage> & { id: number }): SteamGridDbImage {
  return {
    id: opts.id,
    score: opts.score ?? 10,
    style: opts.style ?? 'official',
    url: opts.url ?? `https://sgdb.test/img/${opts.id}.jpg`,
    thumb: opts.thumb ?? `https://sgdb.test/thumb/${opts.id}.jpg`,
    tags: opts.tags ?? [],
    author: opts.author ?? { name: 'test', steam64: '0', avatar: '' },
    language: opts.language ?? 'en',
    notes: opts.notes ?? null,
    width: opts.width ?? 460,
    height: opts.height ?? 215,
    upvotes: opts.upvotes ?? 5,
    downvotes: opts.downvotes ?? 0,
    humor: opts.humor,
    nsfw: opts.nsfw,
  };
}

function makeResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    body: {
      text: vi.fn().mockResolvedValue(JSON.stringify(body)),
      json: vi.fn().mockResolvedValue(body),
    },
  };
}

const apiKey = 'test-api-key';
const apiBase = 'https://www.steamgriddb.com/api/v2';
const timeoutMs = 5000;

describe('SteamGridDbHttpClientImpl', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches grids by steam app id', async () => {
    const images = [makeImage({ id: 1, style: 'alternate' }), makeImage({ id: 2, style: 'official' })];
    const body: SteamGridDbImageResponse = { success: true, data: images };
    vi.mocked(request).mockResolvedValueOnce(makeResponse(200, body));

    const client = new SteamGridDbHttpClientImpl(apiKey, apiBase, timeoutMs);
    const result = await client.getGridsBySteamAppId(620);

    expect(result).toEqual(images);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/grids/steam/620'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${apiKey}`,
        }),
      }),
    );
  });

  it('fetches heroes by steam app id', async () => {
    const images = [makeImage({ id: 10 })];
    const body: SteamGridDbImageResponse = { success: true, data: images };
    vi.mocked(request).mockResolvedValueOnce(makeResponse(200, body));

    const client = new SteamGridDbHttpClientImpl(apiKey, apiBase, timeoutMs);
    const result = await client.getHeroesBySteamAppId(620);

    expect(result).toEqual(images);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/heroes/steam/620'),
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('fetches logos by steam app id', async () => {
    const images = [makeImage({ id: 20 })];
    const body: SteamGridDbImageResponse = { success: true, data: images };
    vi.mocked(request).mockResolvedValueOnce(makeResponse(200, body));

    const client = new SteamGridDbHttpClientImpl(apiKey, apiBase, timeoutMs);
    const result = await client.getLogosBySteamAppId(620);

    expect(result).toEqual(images);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/logos/steam/620'),
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('returns empty array on 4xx response', async () => {
    vi.mocked(request).mockResolvedValueOnce(makeResponse(403, { error: 'forbidden' }));

    const client = new SteamGridDbHttpClientImpl(apiKey, apiBase, timeoutMs);
    const result = await client.getGridsBySteamAppId(620);

    expect(result).toEqual([]);
  });

  it('returns empty array when success is false', async () => {
    const body: SteamGridDbImageResponse = { success: false, data: [], errors: ['not found'] };
    vi.mocked(request).mockResolvedValueOnce(makeResponse(200, body));

    const client = new SteamGridDbHttpClientImpl(apiKey, apiBase, timeoutMs);
    const result = await client.getGridsBySteamAppId(99999);

    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const client = new SteamGridDbHttpClientImpl(apiKey, apiBase, timeoutMs);
    const result = await client.getGridsBySteamAppId(620);

    expect(result).toEqual([]);
  });

  it('retries on 429 and succeeds', async () => {
    const images = [makeImage({ id: 1 })];
    const body: SteamGridDbImageResponse = { success: true, data: images };
    vi.mocked(request)
      .mockResolvedValueOnce(makeResponse(429, {}))
      .mockResolvedValueOnce(makeResponse(200, body));

    const client = new SteamGridDbHttpClientImpl(apiKey, apiBase, timeoutMs);
    const promise = client.getGridsBySteamAppId(620);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toEqual(images);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('appends query params to URL', async () => {
    const body: SteamGridDbImageResponse = { success: true, data: [] };
    vi.mocked(request).mockResolvedValueOnce(makeResponse(200, body));

    const client = new SteamGridDbHttpClientImpl(apiKey, apiBase, timeoutMs);
    await client.getGridsBySteamAppId(620, {
      styles: ['alternate', 'blurred'],
      nsfw: 'false',
      humor: 'false',
      types: ['static'],
    });

    const calledUrl = (vi.mocked(request).mock.calls[0] as string[])[0];
    const url = new URL(calledUrl);
    expect(url.searchParams.get('styles')).toBe('alternate,blurred');
    expect(url.searchParams.get('nsfw')).toBe('false');
    expect(url.searchParams.get('humor')).toBe('false');
    expect(url.searchParams.get('types')).toBe('static');
  });

  it('omits query params when no query provided', async () => {
    const body: SteamGridDbImageResponse = { success: true, data: [] };
    vi.mocked(request).mockResolvedValueOnce(makeResponse(200, body));

    const client = new SteamGridDbHttpClientImpl(apiKey, apiBase, timeoutMs);
    await client.getGridsBySteamAppId(620);

    const calledUrl = (vi.mocked(request).mock.calls[0] as string[])[0];
    const url = new URL(calledUrl);
    expect(url.search).toBe('');
  });
});
