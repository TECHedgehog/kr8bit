// Steam genres that are not actual genres (game modes, features, etc.)
// These are filtered out from the genres array.
export const STEAM_GENRE_BLOCKLIST = new Set([
  'Multiplayer',
  'Co-op',
  'Free to Play',
  'Massively Multiplayer',
  'Online Co-Op',
  'Online PvP',
  'Shared/Split Screen',
  'Cross-Platform Multiplayer',
  'Singleplayer',
  'VR',
  'VR Only',
  'Tracked Controller Support',
  'VR Supported',
]);

// Maps IGDB genre names to canonical (Steam-based) genre names
export const IGDB_GENRE_MAP: Record<string, string> = {
  'Role-playing (RPG)': 'RPG',
  'Simulator': 'Simulation',
  'Sport': 'Sports',
  'Turn-based strategy (TBS)': 'Strategy',
  'Real Time Strategy (RTS)': 'Strategy',
  'Tactical': 'Strategy',
  'Hack and slash/Beat \'em up': 'Action',
  'Point-and-click': 'Adventure',
  'Quiz/Trivia': 'Trivia',
  'Pinball': 'Pinball',
  'Visual Novel': 'Visual Novel',
};

// Maps IGDB theme names to canonical (Steam-based) genre names
// Note: IGDB returns the full string "4X (explore, expand, exploit, and exterminate)"
// as the theme name, not the short "4X". Both keys are kept for safety.
export const IGDB_THEME_MAP: Record<string, string> = {
  '4X (explore, expand, exploit, and exterminate)': 'Strategy',
  '4X': 'Strategy',
  'Survival': 'Survival',
  'Stealth': 'Stealth',
  'Open world': 'Open World',
  'Horror': 'Horror',
  'Thriller': 'Thriller',
  'Comedy': 'Comedy',
  'Business': 'Simulation',
  'Educational': 'Education',
  'Sandbox': 'Sandbox',
  'Warfare': 'Action',
  'Mystery': 'Mystery',
  'Kids': 'Kids',
  'Sci-fi': 'Sci-fi',
  'Historical': 'Historical',
  'Fantasy': 'Fantasy',
  'Alternate Historical': 'Historical',
  'Non-fiction': 'Non-fiction',
};

/**
 * Normalize genres from a provider into canonical names.
 * - Steam: filters blocklisted non-genre values, then deduplicates
 * - IGDB: maps genres and themes to canonical names, merges and deduplicates
 * - Unknown: passes through unchanged
 */
export function normalizeGenres(
  providerName: string,
  genres: string[],
  themes?: string[],
): string[] {
  if (providerName === 'steam') {
    const filtered = genres.filter((g) => !STEAM_GENRE_BLOCKLIST.has(g));
    return [...new Set(filtered)];
  }

  if (providerName === 'igdb') {
    const mappedGenres = genres.map((g) => IGDB_GENRE_MAP[g] ?? g);
    const mappedThemes = themes?.map((t) => IGDB_THEME_MAP[t] ?? t) ?? [];
    const combined = [...mappedGenres, ...mappedThemes];
    return [...new Set(combined)];
  }

  // Unknown provider: pass through unchanged
  return genres;
}
