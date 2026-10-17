import { ValidationError } from './errors.js';
import type { SettingSpec } from '../modules/settings/settings.types.js';

export const DEFAULT_FILENAME_FORMAT = '{title} ({year}) [{edition}]';
export const CUSTOM_FORMAT_SETTING = 'libraryRenameCustomFormat';
const MAX_FILENAME_FORMAT_LENGTH = 1000;
export const FORMAT_TAGS = ['title', 'year', 'edition', 'platform', 'version', 'dlcs', 'group', 'original'] as const;

export const CUSTOM_FORMAT_SETTING_SPEC: SettingSpec = {
  key: CUSTOM_FORMAT_SETTING,
  kind: 'string',
  default: '',
  constraints: { maxLength: MAX_FILENAME_FORMAT_LENGTH },
  validate: (value) => { validateFilenameFormat(value); },
};

const TAG_PATTERN = /\{([^}]+)\}/gi;
const VALID_TAGS = new Set<string>(FORMAT_TAGS);

export interface FilenameFormatSource {
  title: string | null;
  displayName: string;
  releaseYear: number | null;
  releaseVersion: string | null;
  releaseDlcs: string[];
  releaseGroup: string | null;
  originalEntryName: string | null;
  entryName: string;
}

export function validateFilenameFormat(value: string): string {
  if (!value.trim()) throw new ValidationError('filename format cannot be empty');
  if (value.length > MAX_FILENAME_FORMAT_LENGTH) {
    throw new ValidationError(`filename format too long (max ${MAX_FILENAME_FORMAT_LENGTH} characters)`);
  }
  const unmatchedBraces = value.replace(TAG_PATTERN, '').match(/[{}]/);
  if (unmatchedBraces) throw new ValidationError('filename format contains an unmatched brace');
  for (const match of value.matchAll(TAG_PATTERN)) {
    if (!VALID_TAGS.has(match[1].toLowerCase())) throw new ValidationError(`unsupported filename tag: ${match[1]}`);
  }
  return value.trim();
}

export function resolveFilenameFormat(override?: string, savedCustomFormat?: string | null): string {
  const format = override ?? savedCustomFormat;
  return format?.trim() || DEFAULT_FILENAME_FORMAT;
}

function extractEdition(game: FilenameFormatSource): string {
  const source = `${game.title ?? ''} ${game.originalEntryName ?? ''}`;
  return source.match(/\b((?:Game of the Year|Definitive|Complete|Ultimate|Deluxe|Gold|Platinum|Premium|Legendary|Anniversary|Remastered|Enhanced|Special|Collector(?:'s)?|Director(?:'s)? Cut) Edition?)\b/i)?.[1] ?? '';
}

function extractPlatform(game: FilenameFormatSource): string {
  const source = `${game.title ?? ''} ${game.originalEntryName ?? ''}`;
  return source.match(/\b(PC|Windows|Linux|macOS|Mac|Switch|PS[345]|Xbox(?: One| Series)?|Steam Deck)\b/i)?.[1] ?? '';
}

export function renderFilenameFormat(game: FilenameFormatSource, format: string): string {
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
