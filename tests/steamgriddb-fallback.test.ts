import { describe, expect, it, vi } from 'vitest';
import { SteamGridDbFallback } from '../src/modules/artwork/steamgriddb-fallback.js';
import type { SteamGridDbGame, SteamGridDbImage } from '../src/modules/artwork/steamgriddb/steamgriddb.http.types.js';

function image(overrides: Partial<SteamGridDbImage> = {}): SteamGridDbImage {
  return {
    id: 12, score: 1, style: 'alternate', url: 'https://art.test/grid.png', thumb: '', tags: [],
    author: { name: '', steam64: '', avatar: '' }, language: 'en', notes: null,
    width: 600, height: 900, upvotes: 0, downvotes: 0, humor: false, nsfw: false,
    ...overrides,
  };
}

function game(overrides: Partial<SteamGridDbGame> = {}): SteamGridDbGame {
  return { id: 7, name: 'Example Game', verified: false, ...overrides };
}

function createClient(overrides: Record<string, unknown> = {}) {
  return {
    searchGameByName: vi.fn().mockResolvedValue([game()]),
    getGridsBySteamAppId: vi.fn().mockResolvedValue([]),
    getHeroesBySteamAppId: vi.fn().mockResolvedValue([]),
    getLogosBySteamAppId: vi.fn().mockResolvedValue([]),
    getGridsByGameId: vi.fn().mockResolvedValue([image()]),
    getHeroesByGameId: vi.fn().mockResolvedValue([image({ id: 13, url: 'https://art.test/hero.png' })]),
    ...overrides,
  };
}

describe('SteamGridDbFallback', () => {
  it('selects exact title and year-compatible SteamGridDB result', async () => {
    const staleYear = game({ id: 1, release_date: Date.UTC(2016, 0, 1) / 1000, verified: true });
    const closestYear = game({ id: 2, release_date: Date.UTC(2019, 0, 1) / 1000 });
    const client = createClient({ searchGameByName: vi.fn().mockResolvedValue([staleYear, closestYear]) });
    const fallback = new SteamGridDbFallback(client);

    const result = await fallback.findGame('Example Game', 2018);
    expect(result?.id).toBe(2);
  });

  it('rejects non-exact names and incompatible years', async () => {
    const client = createClient({
      searchGameByName: vi.fn().mockResolvedValue([
        game({ name: 'Example Game Remastered', release_date: Date.UTC(2020, 0, 1) / 1000 }),
        game({ id: 8, release_date: Date.UTC(1999, 0, 1) / 1000 }),
      ]),
    });
    const fallback = new SteamGridDbFallback(client);

    expect(await fallback.findGame('Example Game', 2020)).toBeNull();
  });

  it('prefers Steam app id artwork and ranks safe official images', async () => {
    const client = createClient({
      getGridsBySteamAppId: vi.fn().mockResolvedValue([
        image({ id: 1, score: 100, humor: true }),
        image({ id: 2, score: 4, style: 'official' }),
        image({ id: 3, score: 20, style: 'alternate' }),
      ]),
    });
    const fallback = new SteamGridDbFallback(client);

    const result = await fallback.findArtwork({ steamAppId: 4, title: 'Example Game', kind: 'cover' });
    expect(result?.image.id).toBe(2);
    expect(client.searchGameByName).not.toHaveBeenCalled();
  });

  it('resolves grid art by exact game name and memoizes result', async () => {
    const client = createClient();
    const fallback = new SteamGridDbFallback(client);
    const query = { title: 'Example Game', releaseYear: undefined, kind: 'cover' as const };

    const first = await fallback.findArtwork(query);
    const second = await fallback.findArtwork(query);
    expect(first?.image.id).toBe(12);
    expect(second?.image.id).toBe(12);
    expect(client.searchGameByName).toHaveBeenCalledTimes(1);
    expect(client.getGridsByGameId).toHaveBeenCalledTimes(1);
  });

  it('supports logos by Steam app id only', async () => {
    const client = createClient({
      getLogosBySteamAppId: vi.fn().mockResolvedValue([image({ id: 21, style: 'white' })]),
    });
    const fallback = new SteamGridDbFallback(client);

    expect((await fallback.findArtwork({ steamAppId: 4, title: 'Example Game', kind: 'logo' }))?.image.id).toBe(21);
    expect(await fallback.findArtwork({ title: 'Example Game', kind: 'logo' })).toBeNull();
  });
});
