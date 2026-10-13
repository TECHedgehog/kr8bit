import type { Game } from './library.types.js';

export const DEFAULT_FILENAME_FORMAT = '{title} ({year}) [{edition}]';
export const DEFAULT_FORMAT_SETTING = 'libraryRenameDefaultFormat';
export const CUSTOM_FORMAT_SETTING = 'libraryRenameCustomFormat';
export const FORMAT_TAGS = ['title', 'year', 'edition', 'platform', 'version', 'dlcs', 'group', 'original'] as const;

const TAG_PATTERN = /\{([^}]+)\}/gi;
const VALID_TAGS = new Set<string>(FORMAT_TAGS);

export function validateFilenameFormat(value: string): string {
  if (!value.trim()) throw new Error('filename format cannot be empty');
  for (const match of value.matchAll(TAG_PATTERN)) {
    if (!VALID_TAGS.has(match[1].toLowerCase())) throw new Error(`unsupported filename tag: ${match[1]}`);
  }
  return value.trim();
}

function extractEdition(game: Game): string {
  const source = game.title ?? game.originalEntryName ?? game.entryName;
  return source.match(/\b((?:Game of the Year|Definitive|Complete|Ultimate|Deluxe|Gold|Platinum|Premium|Legendary|Anniversary|Remastered|Enhanced|Special|Collector(?:'s)?|Director(?:'s)? Cut) Edition?)\b/i)?.[1] ?? '';
}

function extractPlatform(game: Game): string {
  const source = `${game.title ?? ''} ${game.originalEntryName ?? ''}`;
  return source.match(/\b(PC|Windows|Linux|macOS|Mac|Switch|PS[345]|Xbox(?: One| Series)?|Steam Deck)\b/i)?.[1] ?? '';
}

export function renderFilenameFormat(game: Game, format: string): string {
  const values: Record<string, string> = {
    title: game.title ?? game.displayName,
    year: game.releaseYear ? String(game.releaseYear) : '',
    edition: extractEdition(game),
    platform: extractPlatform(game),
    version: game.releaseVersion ?? '',
    dlcs: game.releaseDlcs.join(', '),
    group: game.releaseGroup ?? '',
    original: game.originalEntryName ?? game.entryName,
  };
  let rendered = format.replace(TAG_PATTERN, (_match, tag: string) => values[tag.toLowerCase()] ?? '');
  rendered = rendered.replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, '');
  return rendered.replace(/\s{2,}/g, ' ').replace(/\s+([)\]])/g, '$1').trim();
}
