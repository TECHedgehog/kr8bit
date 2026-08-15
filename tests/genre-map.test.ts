import { describe, it, expect } from 'vitest';
import { normalizeGenres, STEAM_GENRE_BLOCKLIST, IGDB_GENRE_MAP, IGDB_THEME_MAP } from '../src/modules/metadata/genre-map.js';

describe('STEAM_GENRE_BLOCKLIST', () => {
  it('contains known non-genre values', () => {
    expect(STEAM_GENRE_BLOCKLIST.has('Multiplayer')).toBe(true);
    expect(STEAM_GENRE_BLOCKLIST.has('Co-op')).toBe(true);
    expect(STEAM_GENRE_BLOCKLIST.has('Free to Play')).toBe(true);
    expect(STEAM_GENRE_BLOCKLIST.has('VR')).toBe(true);
    expect(STEAM_GENRE_BLOCKLIST.has('Singleplayer')).toBe(true);
  });
});

describe('IGDB_GENRE_MAP', () => {
  it('maps IGDB genres to canonical names', () => {
    expect(IGDB_GENRE_MAP['Role-playing (RPG)']).toBe('RPG');
    expect(IGDB_GENRE_MAP['Simulator']).toBe('Simulation');
    expect(IGDB_GENRE_MAP['Sport']).toBe('Sports');
    expect(IGDB_GENRE_MAP['Turn-based strategy (TBS)']).toBe('Strategy');
    expect(IGDB_GENRE_MAP['Real Time Strategy (RTS)']).toBe('Strategy');
    expect(IGDB_GENRE_MAP['Tactical']).toBe('Strategy');
    expect(IGDB_GENRE_MAP['Hack and slash/Beat \'em up']).toBe('Action');
    expect(IGDB_GENRE_MAP['Point-and-click']).toBe('Adventure');
  });
});

describe('IGDB_THEME_MAP', () => {
  it('maps IGDB themes to canonical names', () => {
    expect(IGDB_THEME_MAP['4X']).toBe('Strategy');
    expect(IGDB_THEME_MAP['Survival']).toBe('Survival');
    expect(IGDB_THEME_MAP['Educational']).toBe('Education');
    expect(IGDB_THEME_MAP['Business']).toBe('Simulation');
  });
});

describe('normalizeGenres', () => {
  describe('steam', () => {
    it('filters blocklisted non-genre values', () => {
      const input = ['Action', 'Multiplayer', 'Co-op', 'RPG', 'Free to Play', 'VR'];
      const result = normalizeGenres('steam', input);
      expect(result).toEqual(['Action', 'RPG']);
    });

    it('passes through canonical genres', () => {
      const input = ['Action', 'Adventure', 'RPG', 'Strategy', 'Simulation'];
      const result = normalizeGenres('steam', input);
      expect(result).toEqual(input);
    });

    it('deduplicates after filtering', () => {
      const input = ['Action', 'Multiplayer', 'Action'];
      const result = normalizeGenres('steam', input);
      expect(result).toEqual(['Action']);
    });

    it('handles empty array', () => {
      const result = normalizeGenres('steam', []);
      expect(result).toEqual([]);
    });
  });

  describe('igdb', () => {
    it('maps genres and themes to canonical names', () => {
      const genres = ['Role-playing (RPG)', 'Action'];
      const themes = ['4X', 'Survival'];
      const result = normalizeGenres('igdb', genres, themes);
      expect(result).toEqual(['RPG', 'Action', 'Strategy', 'Survival']);
    });

    it('deduplicates when genre+theme map to same canonical', () => {
      const genres = ['Strategy', 'Turn-based strategy (TBS)', 'Real Time Strategy (RTS)'];
      const themes = ['4X'];
      const result = normalizeGenres('igdb', genres, themes);
      expect(result).toEqual(['Strategy']);
    });

    it('passes through unmapped genres', () => {
      const genres = ['Unknown Genre'];
      const result = normalizeGenres('igdb', genres);
      expect(result).toEqual(['Unknown Genre']);
    });

    it('passes through unmapped themes', () => {
      const themes = ['Unknown Theme'];
      const result = normalizeGenres('igdb', [], themes);
      expect(result).toEqual(['Unknown Theme']);
    });

    it('handles empty arrays', () => {
      const result = normalizeGenres('igdb', [], []);
      expect(result).toEqual([]);
    });

    it('handles undefined themes', () => {
      const genres = ['Action'];
      const result = normalizeGenres('igdb', genres, undefined);
      expect(result).toEqual(['Action']);
    });
  });

  describe('unknown provider', () => {
    it('passes through unchanged', () => {
      const input = ['Action', 'Multiplayer', 'Co-op'];
      const result = normalizeGenres('unknown', input);
      expect(result).toEqual(input);
    });
  });
});
