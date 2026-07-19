import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { SteamProvider } from '../src/modules/metadata/steam/steam.provider.js';
import type {
  SteamAppDetailsResponse,
  SteamStoreSearchItem,
  SteamStoreSearchResponse,
} from '../src/modules/metadata/steam/steam.http.types.js';
import type { SteamHttpClient } from '../src/modules/metadata/steam/steam.http.js';

function makeStoreItem(id: number, name: string, tiny_image?: string): SteamStoreSearchItem {
  return { type: 'app', name, id, tiny_image };
}

function makeMockClient(
  searchByTerm: Record<string, SteamStoreSearchResponse> = {},
  detailsByAppId: Record<number, SteamAppDetailsResponse[string]> = {},
): SteamHttpClient {
  return {
    searchStore: vi.fn(async (term: string) => {
      const entry = Object.entries(searchByTerm).find(([key]) =>
        term.toLowerCase().includes(key.toLowerCase()),
      );
      return entry ? entry[1] : { total: 0, items: [] };
    }),
    fetchAppDetails: vi.fn(async (appId: number): Promise<SteamAppDetailsResponse> => {
      const entry = detailsByAppId[appId];
      if (!entry) return {};
      return { [String(appId)]: entry };
    }),
  };
}

beforeEach(async () => {
  await prisma.game.deleteMany({});
  await prisma.scanRun.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('SteamProvider.search', () => {
  it('returns matches scored via fuzzy comparison', async () => {
    const provider = new SteamProvider(
      makeMockClient({
        skyrim: {
          total: 3,
          items: [
            makeStoreItem(72850, 'The Elder Scrolls V: Skyrim'),
            makeStoreItem(489830, 'The Elder Scrolls V: Skyrim Special Edition'),
            makeStoreItem(1746860, 'The Elder Scrolls V: Skyrim Anniversary Upgrade'),
          ],
        },
      }),
    );
    const results = await provider.search('Skyrim');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(20);
    expect(results[0].title).toContain('Skyrim');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('returns empty array for empty query', async () => {
    const provider = new SteamProvider(makeMockClient());
    expect(await provider.search('')).toEqual([]);
    expect(await provider.search('   ')).toEqual([]);
  });

  it('returns empty list when storesearch returns no items', async () => {
    const provider = new SteamProvider(makeMockClient({ nomatch: { total: 0, items: [] } }));
    expect(await provider.search('Inexistent Game 12345')).toEqual([]);
  });

  it('returns empty list on HTTP error', async () => {
    const client: SteamHttpClient = {
      searchStore: vi.fn(async () => { throw new Error('bad gateway'); }),
      fetchAppDetails: vi.fn(),
    };
    const provider = new SteamProvider(client);
    expect(await provider.search('Anything')).toEqual([]);
  });

  it('limits results to SEARCH_LIMIT', async () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeStoreItem(i, `Skyrim Variant ${i}`),
    );
    const provider = new SteamProvider(
      makeMockClient({ skyrim: { total: items.length, items } }),
    );
    const results = await provider.search('Skyrim');
    expect(results.length).toBeLessThanOrEqual(20);
  });
});

describe('SteamProvider.getGame', () => {
  it('maps appdetails to GameMetadata', async () => {
    const details: SteamAppDetailsResponse[string] = {
      success: true,
      data: {
        steam_appid: 620,
        name: 'Portal 2',
        type: 'game',
        release_date: { date: '18 Apr, 2011' },
        developers: ['Valve'],
        publishers: ['Valve'],
        genres: [
          { id: '1', description: 'Action' },
          { id: '21', description: 'Puzzle' },
        ],
        short_description: 'A puzzle game.',
        header_image: 'https://x/header.jpg',
      },
    };
    const provider = new SteamProvider(makeMockClient({}, { 620: details }));
    const game = await provider.getGame('620');
    expect(game).not.toBeNull();
    expect(game?.remoteId).toBe('620');
    expect(game?.title).toBe('Portal 2');
    expect(game?.releaseYear).toBe(2011);
    expect(game?.developers).toEqual(['Valve']);
    expect(game?.publishers).toEqual(['Valve']);
    expect(game?.genres).toEqual(['Action', 'Puzzle']);
    expect(game?.description).toBe('A puzzle game.');
    expect(game?.coverUrl).toContain('/620/library_600x900.jpg');
    expect(game?.headerUrl).toBe('https://x/header.jpg');
  });

  it('returns null when success is false', async () => {
    const provider = new SteamProvider(
      makeMockClient({}, { '999': { success: false } } as unknown as Record<number, SteamAppDetailsResponse[string]>),
    );
    expect(await provider.getGame('999')).toBeNull();
  });

  it('returns null for invalid id', async () => {
    const provider = new SteamProvider(makeMockClient());
    expect(await provider.getGame('notanumber')).toBeNull();
    expect(await provider.getGame('-5')).toBeNull();
    expect(await provider.getGame('0')).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    const client: SteamHttpClient = {
      searchStore: vi.fn(),
      fetchAppDetails: vi.fn(async () => { throw new Error('steam http 429'); }),
    };
    const provider = new SteamProvider(client);
    expect(await provider.getGame('620')).toBeNull();
  });
});

describe('SteamProvider interface', () => {
  it('exposes a stable name', () => {
    const provider = new SteamProvider(makeMockClient());
    expect(provider.name).toBe('steam');
  });
});