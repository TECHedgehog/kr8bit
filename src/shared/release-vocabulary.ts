export const REPACK_GROUPS = [
  'fitgirl', 'dodi', 'elamigos', 'codex', 'rune', 'plaza', 'reloaded', 'goldberg', 'hoodlum',
  'empress', 'skidrow', 'tforce', 'onlinefix', 'darksiders', 'tinyiso', 'prophet', 'tenoke',
  'purlife', 'doge', 'kaos', 'rg mechanics', 'xatab', 'flt', 'rld', 'sr', 'razor1911',
] as const;

export const KNOWN_EDITIONS = [
  'game of the year edition', 'directors cut edition', "director's cut edition",
  'remastered edition', 'remaster edition', 'goty edition',
  'definitive edition', 'enhanced edition', 'complete edition', 'ultimate edition',
  'standard edition', 'collector edition', "collector's edition", 'collectors edition',
  'limited edition', 'special edition', 'classic edition', 'anniversary edition',
  'legendary edition', 'gold edition', 'platinum edition', 'premium edition', 'deluxe edition',
  'redux edition', 'rebirth edition', 'remix edition', 'remake edition', 'hd edition', 'uhd edition',
  'remaster', 'remastered', 'goty', 'directors cut', "director's cut",
] as const;

export const EDITION_WORDS_FOR_FILENAME = [
  'Game of the Year', 'Definitive', 'Complete', 'Ultimate', 'Deluxe', 'Gold', 'Platinum',
  'Premium', 'Legendary', 'Anniversary', 'Remastered', 'Enhanced', 'Special', 'Collector(?:\'s)?',
  'Director(?:\'s)? Cut',
] as const;

export const REGION_TAGS = [
  'US', 'EU', 'JP', 'PAL', 'NA', 'AS', 'AU', 'UK', 'Global', 'Worldwide',
] as const;

export const LANGUAGE_TAGS = [
  'EN', 'ENG', 'ENGLISH', 'RU', 'RUS', 'RUSSIAN', 'FR', 'FRA', 'FRENCH', 'DE', 'DEU', 'GERMAN',
  'ES', 'SPA', 'SPANISH', 'IT', 'ITA', 'ITALIAN', 'PT', 'POR', 'PORTUGUESE', 'BR', 'JA', 'JPN',
  'JAPANESE', 'ZH', 'CHS', 'CHT', 'CHINESE', 'KO', 'KOR', 'KOREAN', 'PL', 'POL', 'POLISH',
  'TR', 'TUR', 'TURKISH', 'NL', 'DUTCH', 'CS', 'CZECH', 'HU', 'HUNGARIAN', 'MULTI',
] as const;

export const PLATFORM_TAGS = [
  'PC', 'Windows', 'Win7', 'Win8', 'Win10', 'Win11', 'Linux', 'macOS', 'Mac', 'x64', 'x86',
  '64bit', '32bit', 'Steam Deck', 'Switch', 'PS3', 'PS4', 'PS5', 'Xbox One', 'Xbox Series',
] as const;

export const FILENAME_PLATFORM_TAGS = [
  'PC', 'Windows', 'Linux', 'macOS', 'Mac', 'Switch', 'PS3', 'PS4', 'PS5', 'Xbox One', 'Xbox Series', 'Steam Deck',
] as const;

export const NOISE_TAGS = [
  'DLCs?', 'Update\\s*\\d*', 'Patch\\s*\\d*', 'Hotfix\\s*\\d*', 'Build\\s*\\d+',
  'Bonus', 'OST', 'Soundtrack', 'Strategy\\s+Guide', 'Repack', 'ISO', 'Steamless', 'Cracked', 'Steam\\s*Rip',
] as const;

export const SCENE_NOISE_TAGS = [
  'PROPER', 'READNFO', 'iNTERNAL', 'RiP', 'UNLOCKED', 'KEYGEN', 'CRACK\\s+ONLY',
] as const;

export const DELIMITED_NOISE_TAGS = [
  'repack', 'fitgirl', 'gog', 'multi\\d*', 'steamless', 'iso', 'cracked', 'steam\\s*rip',
  'release', 'recompiled\\s+for\\s+pc',
  'hd', 'uhd', 'onlinefix', 'dodi', 'codex', 'elamigos', 'tforce', 'skidrow', 'reloaded',
  'plaza', 'hoodlum', 'empress', 'goldberg', 'rune', 'darksiders', 'tinyiso', 'prophet',
  'tenoke', 'purlife', 'doge', 'kaos', 'rg\\s*mechanics', 'xatab', 'flt', 'rld', 'sr',
] as const;

export const VERSION_PATTERN = /\b(?:v|ver|version)[\s._-]*(\d+(?:[._]\d+)*)\b|\b(\d+(?:\.\d+){2,})\b/i;
export const VERSION_STRIP_PATTERN = /\b(?:v|ver|version)[\s._-]*\d+(?:[._]\d+)*\b|\b\d+(?:\.\d+){2,}\b/gi;
export const BUILD_PATTERN = /\b(?:build|update|patch|hotfix)\s*\d+(?:[._-]\d+)*\b/gi;
export const ARCHIVE_EXTENSION_PATTERN = /\.(?:7z|zip|rar|r\d{2,3}|part\d+\.rar|tar(?:\.gz)?|gz|bz2|xz|iso|exe|msi|bin)$/i;
export const MULTI_WHITESPACE = /\s+/g;

export function escapeVocabulary(values: readonly string[]): string {
  return values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}
