import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { IgdbProvider } from '../src/modules/metadata/igdb/igdb.provider.js';
import type { IgdbGame } from '../src/modules/metadata/igdb/igdb.http.types.js';
import type { IgdbHttpClient } from '../src/modules/metadata/igdb/igdb.http.js';

function makeGame(opts: Partial<IgdbGame> & { id: number; name: string }): IgdbGame {
  return {
    id: opts.id,
    name: opts.name,
    summary: opts.summary,
    first_release_date: opts.first_release_date,
    cover: opts.cover,
    artworks: opts.artworks,
    genres: opts.genres,
    involved_companies: opts.involved_companies,
    screenshots: opts.screenshots,
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
      genres: [
        { id: 1, name: 'Action' },
        { id: 2, name: 'Puzzle' },
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
    expect(result!.genres).toEqual(['Action', 'Puzzle']);
    expect(result!.description).toBe('A puzzle game.');
    expect(result!.coverUrl).toBe('https://images.igdb.com/igdb/cover/abc/t_1080p/co_abc.jpg');
    expect(result!.headerUrl).toBe('https://images.igdb.com/igdb/artwork/def/t_1080p/ar_def.jpg');
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

describe('IgdbProvider interface', () => {
  it('exposes a stable name', () => {
    const provider = new IgdbProvider(makeMockClient());
    expect(provider.name).toBe('igdb');
  });
});