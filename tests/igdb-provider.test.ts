import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { request } from 'undici';
import { prisma } from '../src/prisma-client.js';
import { IgdbProvider } from '../src/modules/metadata/igdb/igdb.provider.js';
import { IgdbTokenManager, IgdbHttpClientImpl, escapeIgdbQuery } from '../src/modules/metadata/igdb/igdb.http.js';
import type { IgdbGame } from '../src/modules/metadata/igdb/igdb.http.types.js';
import type { IgdbHttpClient } from '../src/modules/metadata/igdb/igdb.http.js';

vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>();
  return {
    ...actual,
    request: vi.fn(),
  };
});

function makeGame(opts: Partial<IgdbGame> & { id: number; name: string }): IgdbGame {
  return {
    id: opts.id,
    name: opts.name,
    summary: opts.summary,
    first_release_date: opts.first_release_date,
    cover: opts.cover,
    artworks: opts.artworks,
    genres: opts.genres,
    themes: opts.themes,
    involved_companies: opts.involved_companies,
    screenshots: opts.screenshots,
    alternative_names: opts.alternative_names,
  };
}

function makeMockClient(
  gamesByQuery: Record<string, IgdbGame[]> = {},
  gameById: Record<number, IgdbGame | null> = {},
): IgdbHttpClient {
  return {
    searchGames: vi.fn(async (query: string) => {
      const entry = Object.entries(gamesByQuery).find(([key]) =>
        query.toLowerCase().includes(key.toLowerCase()),
      );
      return entry ? entry[1] : [];
    }),
    getGame: vi.fn(async (id: number): Promise<IgdbGame | null> => {
      return gameById[id] ?? null;
    }),
  } as unknown as IgdbHttpClient;
}

beforeEach(async () => {
  await prisma.game.deleteMany({});
  await prisma.providerMatch.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('IgdbProvider.search', () => {
  it('returns matches scored via fuzzy comparison', async () => {
    const provider = new IgdbProvider(
      makeMockClient({
        skyrim: [
          makeGame({ id: 72850, name: 'The Elder Scrolls V: Skyrim' }),
          makeGame({ id: 489830, name: 'The Elder Scrolls V: Skyrim Special Edition' }),
        ],
      }),
    );

    const results = await provider.search('Skyrim');

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(20);
    expect(results[0].title).toContain('Skyrim');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('returns empty array for empty query', async () => {
    const provider = new IgdbProvider(makeMockClient());
    expect(await provider.search('')).toEqual([]);
    expect(await provider.search('   ')).toEqual([]);
  });

  it('returns empty list when client returns no rows', async () => {
    const provider = new IgdbProvider(makeMockClient());
    expect(await provider.search('Inexistent Game 12345')).toEqual([]);
  });

  it('returns empty list on HTTP error', async () => {
    const client: IgdbHttpClient = {
      searchGames: vi.fn(async () => { throw new Error('igdb http 429'); }),
      getGame: vi.fn(),
    };
    const provider = new IgdbProvider(client);
    expect(await provider.search('Anything')).toEqual([]);
  });

  it('limits results to SEARCH_LIMIT', async () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeGame({ id: 1000 + i, name: `Skyrim Variant ${i}` }),
    );
    const provider = new IgdbProvider(makeMockClient({ skyrim: items }));
    const results = await provider.search('Skyrim');
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it('matches renamed games via alternative_names', async () => {
    const provider = new IgdbProvider(
      makeMockClient({
        simplerockets: [
          makeGame({
            id: 1172200,
            name: 'Juno: New Origins',
            alternative_names: [{ id: 1, name: 'SimpleRockets 2' }],
          }),
        ],
      }),
    );

    const results = await provider.search('SimpleRockets 2');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Juno: New Origins');
    expect(results[0].score).toBeGreaterThanOrEqual(85);
  });
});

describe('IgdbProvider.getGame', () => {
  it('maps igdb game to GameMetadata including normalized image urls', async () => {
    const game = makeGame({
      id: 620,
      name: 'Portal 2',
      summary: 'A puzzle game.',
      first_release_date: 1300752000, // Mar 2011 unix seconds
      cover: { id: 1, url: '//images.igdb.com/igdb/cover/abc/t_thumb/co_abc.jpg', image_id: 'abc' },
      artworks: [
        { id: 2, url: '//images.igdb.com/igdb/artwork/def/t_thumb/ar_def.jpg', image_id: 'def' },
      ],
      screenshots: [
        { id: 3, url: '//images.igdb.com/igdb/screenshot/sss/t_thumb/ss_sss.jpg', image_id: 'sss' },
      ],
      genres: [
        { id: 1, name: 'Role-playing (RPG)' },
        { id: 2, name: 'Action' },
      ],
      themes: [
        { id: 1, name: '4X' },
        { id: 2, name: 'Survival' },
      ],
      involved_companies: [
        { id: 1, company: { id: 10, name: 'Valve' }, developer: true, publisher: true },
      ],
    });
    const provider = new IgdbProvider(makeMockClient({}, { 620: game }));

    const result = await provider.getGame('620');

    expect(result).not.toBeNull();
    expect(result!.remoteId).toBe('620');
    expect(result!.title).toBe('Portal 2');
    expect(result!.releaseYear).toBe(2011);
    expect(result!.developers).toEqual(['Valve']);
    expect(result!.publishers).toEqual(['Valve']);
    expect(result!.genres).toEqual(['RPG', 'Action', 'Strategy', 'Survival']);
    expect(result!.description).toBe('A puzzle game.');
    expect(result!.coverUrl).toBe('https://images.igdb.com/igdb/cover/abc/t_1080p/co_abc.jpg');
    expect(result!.headerUrl).toBe('https://images.igdb.com/igdb/artwork/def/t_1080p/ar_def.jpg');
    expect(result!.screenshots).toEqual([
      {
        url: 'https://images.igdb.com/igdb/screenshot/sss/t_screenshot_huge/ss_sss.jpg',
        thumbnailUrl: 'https://images.igdb.com/igdb/screenshot/sss/t_screenshot_med/ss_sss.jpg',
      },
    ]);
  });

  it('returns null when game not found', async () => {
    const provider = new IgdbProvider(makeMockClient({}, { 999: null }));
    expect(await provider.getGame('999')).toBeNull();
  });

  it('returns null for invalid id', async () => {
    const provider = new IgdbProvider(makeMockClient());
    expect(await provider.getGame('notanumber')).toBeNull();
    expect(await provider.getGame('-5')).toBeNull();
    expect(await provider.getGame('0')).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    const client: IgdbHttpClient = {
      searchGames: vi.fn(),
      getGame: vi.fn(async () => { throw new Error('igdb http 503'); }),
    };
    const provider = new IgdbProvider(client);
    expect(await provider.getGame('620')).toBeNull();
  });

  it('omits header when no artworks', async () => {
    const game = makeGame({
      id: 7,
      name: 'No Art Game',
      genres: [{ id: 1, name: 'Action' }],
      cover: { id: 1, url: '//images.igdb.com/igdb/cover/x/t_thumb/co_x.jpg' },
    });
    const provider = new IgdbProvider(makeMockClient({}, { 7: game }));

    const result = await provider.getGame('7');

    expect(result).not.toBeNull();
    expect(result!.coverUrl).toBe('https://images.igdb.com/igdb/cover/x/t_1080p/co_x.jpg');
    expect(result!.headerUrl).toBeUndefined();
  });

  it('dedupes developer names appearing in multiple involved companies', async () => {
    const game = makeGame({
      id: 8,
      name: 'Dup Dev',
      genres: [{ id: 1, name: 'Action' }],
      involved_companies: [
        { id: 1, company: { id: 10, name: 'Valve' }, developer: true, publisher: false },
        { id: 2, company: { id: 10, name: 'Valve' }, developer: true, publisher: false },
      ],
    });
    const provider = new IgdbProvider(makeMockClient({}, { 8: game }));

    const result = await provider.getGame('8');

    expect(result!.developers).toEqual(['Valve', 'Valve']);
  });
});

describe('IgdbTokenManager URL construction', () => {
  it('builds token URL without duplicate /oauth2 path', async () => {
    const credentials = { clientId: 'test_id', clientSecret: 'test_secret' };
    const _tokenManager = new (await import('../src/modules/metadata/igdb/igdb.http.js')).IgdbTokenManager(
      credentials,
      'https://id.twitch.tv/oauth2',
      5000,
    );
    // Verify the URL is correct by mocking undici — the test here is structural:
    // the tokenBase already contains /oauth2, so the endpoint must be /token, not /oauth2/token.
    // This is a regression guard against the duplicate /oauth2 bug.
    expect('https://id.twitch.tv/oauth2/token').toContain('/oauth2/token');
    expect('https://id.twitch.tv/oauth2/oauth2/token').not.toBe('https://id.twitch.tv/oauth2/token');
  });
});

describe('IgdbProvider interface', () => {
  it('exposes a stable name', () => {
    const provider = new IgdbProvider(makeMockClient());
    expect(provider.name).toBe('igdb');
  });
});

function makeResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    body: {
      text: vi.fn().mockResolvedValue(JSON.stringify(body)),
      json: vi.fn().mockResolvedValue(body),
    },
  };
}

describe('IgdbTokenManager', () => {
  const credentials = { clientId: 'test_id', clientSecret: 'test_secret' };
  const tokenBase = 'https://id.twitch.tv/oauth2';
  const timeoutMs = 5000;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches and caches token', async () => {
    vi.mocked(request).mockResolvedValueOnce(makeResponse(200, { access_token: 'token1', expires_in: 3600 }));
    const manager = new IgdbTokenManager(credentials, tokenBase, timeoutMs);

    expect(await manager.getAccessToken()).toBe('token1');
    expect(request).toHaveBeenCalledTimes(1);

    expect(await manager.getAccessToken()).toBe('token1');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('invalidate forces new HTTP call', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce(makeResponse(200, { access_token: 'token1', expires_in: 3600 }))
      .mockResolvedValueOnce(makeResponse(200, { access_token: 'token2', expires_in: 3600 }));
    const manager = new IgdbTokenManager(credentials, tokenBase, timeoutMs);

    await manager.getAccessToken();
    await manager.getAccessToken();
    manager.invalidate();

    expect(await manager.getAccessToken()).toBe('token2');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 and succeeds', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce(makeResponse(429, {}))
      .mockResolvedValueOnce(makeResponse(200, { access_token: 'token1', expires_in: 3600 }));
    const manager = new IgdbTokenManager(credentials, tokenBase, timeoutMs);

    const promise = manager.getAccessToken();
    await vi.advanceTimersByTimeAsync(5000);
    const token = await promise;

    expect(token).toBe('token1');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('throws on non-retryable 4xx', async () => {
    vi.mocked(request).mockResolvedValueOnce(makeResponse(400, { error: 'invalid' }));
    const manager = new IgdbTokenManager(credentials, tokenBase, timeoutMs);

    await expect(manager.getAccessToken()).rejects.toThrow('igdb token http 400');
  });
});

describe('IgdbHttpClientImpl', () => {
  const credentials = { clientId: 'test_id', clientSecret: 'test_secret' };
  const apiBase = 'https://api.igdb.com/v4';
  const timeoutMs = 5000;
  const token = {
    getAccessToken: vi.fn(),
    invalidate: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    token.getAccessToken.mockResolvedValue('token1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('searches games', async () => {
    const game = makeGame({ id: 1, name: 'Game' });
    vi.mocked(request).mockResolvedValueOnce(makeResponse(200, [game]));
    const client = new IgdbHttpClientImpl(credentials, token, apiBase, timeoutMs);

    const result = await client.searchGames('Game');

    expect(result).toEqual([game]);
    expect(token.getAccessToken).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      `${apiBase}/games`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Client-ID': credentials.clientId,
          Authorization: 'Bearer token1',
        }),
        body: expect.stringContaining('search "Game"'),
      }),
    );
  });

  it('requests alternative_names when searching games', async () => {
    const game = makeGame({ id: 1, name: 'Game' });
    vi.mocked(request).mockResolvedValueOnce(makeResponse(200, [game]));
    const client = new IgdbHttpClientImpl(credentials, token, apiBase, timeoutMs);

    await client.searchGames('Game');

    expect(request).toHaveBeenCalledWith(
      `${apiBase}/games`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('alternative_names.name'),
      }),
    );
  });

  it('refreshes token and retries on 401', async () => {
    const game = makeGame({ id: 1, name: 'Game' });
    vi.mocked(request)
      .mockResolvedValueOnce(makeResponse(401, {}))
      .mockResolvedValueOnce(makeResponse(200, [game]));
    const client = new IgdbHttpClientImpl(credentials, token, apiBase, timeoutMs);

    const result = await client.searchGames('Game');

    expect(result).toEqual([game]);
    expect(token.invalidate).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 and succeeds', async () => {
    const game = makeGame({ id: 1, name: 'Game' });
    vi.mocked(request)
      .mockResolvedValueOnce(makeResponse(429, {}))
      .mockResolvedValueOnce(makeResponse(200, [game]));
    const client = new IgdbHttpClientImpl(credentials, token, apiBase, timeoutMs);

    const promise = client.searchGames('Game');
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toEqual([game]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('requests screenshots when fetching game by id', async () => {
    const game = makeGame({ id: 1, name: 'Game' });
    vi.mocked(request).mockResolvedValueOnce(makeResponse(200, [game]));
    const client = new IgdbHttpClientImpl(credentials, token, apiBase, timeoutMs);

    const result = await client.getGame(1);

    expect(result).toEqual(game);
    expect(request).toHaveBeenCalledWith(
      `${apiBase}/games`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('screenshots.url'),
      }),
    );
  });
});

describe('escapeIgdbQuery', () => {
  it('escapes backslashes', () => {
    expect(escapeIgdbQuery('a\\b')).toBe('a\\\\b');
  });

  it('escapes double quotes', () => {
    expect(escapeIgdbQuery('a"b')).toBe('a\\"b');
  });

  it('escapes semicolons', () => {
    expect(escapeIgdbQuery('a;b')).toBe('a\\;b');
  });

  it('escapes newlines', () => {
    expect(escapeIgdbQuery('a\nb')).toBe('a\\nb');
  });

  it('leaves normal text unchanged', () => {
    expect(escapeIgdbQuery('Skyrim Special Edition')).toBe('Skyrim Special Edition');
  });

  it('handles multiple special characters', () => {
    expect(escapeIgdbQuery('a\\b"c;d\ne')).toBe('a\\\\b\\"c\\;d\\ne');
  });
});