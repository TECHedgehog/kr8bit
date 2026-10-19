import type { EntryType } from './enums.js';
import {
  ARCHIVE_EXTENSION_PATTERN,
  BUILD_PATTERN,
  DELIMITED_NOISE_TAGS,
  KNOWN_EDITIONS,
  LANGUAGE_TAGS,
  MULTI_WHITESPACE,
  NOISE_TAGS,
  PLATFORM_TAGS,
  REGION_TAGS,
  REPACK_GROUPS,
  SCENE_NOISE_TAGS,
  TAIL_EDITION_MARKERS,
  VERSION_PATTERN,
  VERSION_STRIP_PATTERN,
  escapeVocabulary,
} from './release-vocabulary.js';

export interface ParsedReleaseName {
  baseTitle: string;
  year?: number;
  version?: string;
  group?: string;
  dlcs: string[];
  editions: Array<{ name: string; known: boolean }>;
  languages: string[];
  platform?: string;
  region?: string;
  noise: string[];
}

const YEAR_IN_DELIMITERS = /[([]\s*(19\d{2}|20\d{2})\s*[)\]]/g;
const GROUP_CAPTURE_PATTERN = new RegExp(`(${escapeVocabulary(REPACK_GROUPS)})`, 'i');
const DELIMITED_GROUP_PATTERN = new RegExp(`[([](?:[^)\\]]*\\b)?(${escapeVocabulary(REPACK_GROUPS)})(?:\\s+(?:repack|repacks))?[^)\\]]*[)\\]]`, 'gi');
const DELIMITED_NOISE_PATTERN = new RegExp(`[([][^)\\]]*(?:${DELIMITED_NOISE_TAGS.join('|')})[^)\\]]*[)\\]]`, 'gi');
const SUFFIX_GROUP_PATTERN = new RegExp(`(?:^|[\\s._-])(${escapeVocabulary(REPACK_GROUPS)})(?:[\\s._-]+repack(?:s)?)?$`, 'i');
const PREFIX_GROUP_PATTERN = /^(?:rld|sr|flt)-/i;
const LANGUAGE_CODES = `(?:${escapeVocabulary(LANGUAGE_TAGS)})`;
const LANGUAGE_PATTERN = new RegExp(`\\b(?:MULTI\\d*|${LANGUAGE_CODES})(?:\\s*[/,+-]\\s*\\b${LANGUAGE_CODES})*\\b`, 'gi');
const LANGUAGE_SUFFIX_PATTERN = new RegExp(`(?:^|\\s)((?:MULTI\\d*|\\b${LANGUAGE_CODES}\\b)(?:\\s*[/,+-]\\s*(?:MULTI\\d*|\\b${LANGUAGE_CODES}\\b))*)$`, 'i');
const TAIL_EDITION_PATTERN = new RegExp(
  `(?:\\s*[:,;–—-]\\s*|\\s+)(${escapeVocabulary(TAIL_EDITION_MARKERS)})[\\s*!?.–—-]*$`,
  'i',
);
const NOISE_PATTERN = new RegExp(`\\b(?:${NOISE_TAGS.join('|')})\\b`, 'gi');
const DELIMITED_SCENE_NOISE_PATTERN = new RegExp(`[([][^)\\]]*(?:${SCENE_NOISE_TAGS.join('|')})[^)\\]]*[)\\]]`, 'gi');
const SUFFIX_SCENE_NOISE_PATTERN = new RegExp(`(?:^|[\\s._-])(?:${SCENE_NOISE_TAGS.join('|')})$`, 'i');
const DISC_PATTERN = /[([]?\s*Disc\s*\d+(?:\s+of\s+\d+)?\s*[)\]]?/gi;
const DEV_STAGE_PATTERN = /[([]\s*(?:Early\s+Access|Alpha|Beta|Preview|Demo|Prototype)\b[^)\]]*[)\]]/gi;
const NON_DLC_PLUS_SEGMENT = /^(?:update|patch|hotfix|build|repack)\b/i;
const DLC_MARKER_PATTERN = /\bDLCs?\s*[:=-]\s*([^+()[\]]+)/gi;
const PLUS_SEGMENT_PATTERN = /\+\s*([^+()[\]]+)/g;
const DLC_TAIL_PATTERN = /\s*(?:(?:[,;]\s*)?\+\s*(?:\d+\s*)?DLCs?(?:\/Bonuses?)?|(?:[,;]\s*)?\+\s*Content\b|[&,:;–—-]\s*(?:all|included|bonus)\s+DLCs?|\b(?:all|included|bonus)\s+DLCs?|\bDLCs?\s*[:=-]|[&,:;–—-]\s*DLC\s+Pack\s*#?\d+|\bDLC\s+Pack\s*#?\d+)[^\n]*$/gi;
const OPAQUE_RELEASE_SUFFIX_PATTERN = /\s+[–—-]\s*(?:\+\s*\d+|\.\d+[a-z])\s*$/i;

function getDelimitedYear(name: string): { title: string; year?: number } {
  const years = [...name.matchAll(YEAR_IN_DELIMITERS)]
    .map((match) => Number(match[1]))
    .filter((year) => year >= 1980 && year <= new Date().getFullYear() + 1);
  return {
    title: years.length ? name.replace(YEAR_IN_DELIMITERS, ' ') : name,
    year: years.length ? Math.max(...years) : undefined,
  };
}

function getDlcs(name: string): string[] {
  const dlcs = new Set<string>();
  for (const match of name.matchAll(DLC_MARKER_PATTERN)) {
    const value = match[1].trim();
    if (value && !NON_DLC_PLUS_SEGMENT.test(value)) dlcs.add(value.replace(/[._]+/g, ' '));
  }
  for (const match of name.matchAll(PLUS_SEGMENT_PATTERN)) {
    const segment = match[1].trim();
    if (!segment || NON_DLC_PLUS_SEGMENT.test(segment)) continue;
    const value = segment.replace(/^DLCs?\s*[:=-]?\s*/i, '').trim();
    if (value && !/^DLCs?$/i.test(value)) dlcs.add(value.replace(/[._]+/g, ' '));
  }
  for (const match of name.matchAll(/\b(?:all|included|bonus)\s+DLCs?\b/gi)) dlcs.add(match[0]);
  return [...dlcs];
}

function removeKnownEditions(name: string, editions: ParsedReleaseName['editions']): string {
  const knownPattern = new RegExp(`\\b(?:${escapeVocabulary([...KNOWN_EDITIONS].sort((left, right) => right.length - left.length))})\\b`, 'gi');
  return name.replace(knownPattern, (edition) => {
    editions.push({ name: edition, known: true });
    return ' ';
  });
}

function removeUnknownEditionSuffix(name: string, editions: ParsedReleaseName['editions']): string {
  const pattern = /(?:\s*[:,;–—-]\s*)([\p{L}\p{N}][\p{L}\p{N}'’‘&-]*(?:\s+[\p{L}\p{N}'’‘&-]+)*\s+Edition)[\s*!?.–—-]*$/iu;
  return name.replace(pattern, (phrase) => {
    const edition = phrase.match(/([\p{L}\p{N}][\p{L}\p{N}'’‘&-]*(?:\s+[\p{L}\p{N}'’‘&-]+)*\s+Edition)/iu)?.[1];
    if (edition) editions.push({ name: edition, known: false });
    return phrase;
  });
}

function tailTagPattern(values: readonly string[]): RegExp {
  const alternatives = escapeVocabulary(values);
  return new RegExp(`\\s+(?:${alternatives})(?=(?:\\s+(?:${alternatives}))*\\s*(?:\\[[^\\]]*\\]|\\([^)]*\\))*$)`, 'gi');
}

export function parseReleaseName(rawName: string, entryType?: EntryType): ParsedReleaseName {
  let name = rawName;
  if (!entryType || entryType === 'ARCHIVE') name = name.replace(ARCHIVE_EXTENSION_PATTERN, '');

  const versionMatch = name.match(VERSION_PATTERN);
  const version = versionMatch ? (versionMatch[1] ?? versionMatch[2]).replace(/_/g, '.') : undefined;
  const dlcs = getDlcs(name);
  const groupMatch = name.match(DELIMITED_GROUP_PATTERN)?.[0]?.match(GROUP_CAPTURE_PATTERN)?.[1]
    ?? name.match(SUFFIX_GROUP_PATTERN)?.[1]
    ?? name.match(PREFIX_GROUP_PATTERN)?.[0]?.slice(0, -1);
  const group = groupMatch;
  const editions: ParsedReleaseName['editions'] = [];
  const languages: string[] = [];
  const noise: string[] = [];
  let platform: string | undefined;
  let region: string | undefined;

  name = name.replace(DELIMITED_GROUP_PATTERN, (match) => {
    const detected = match.match(GROUP_CAPTURE_PATTERN)?.[1];
    if (detected) noise.push(detected);
    return ' ';
  });
  name = name.replace(DELIMITED_NOISE_PATTERN, (match) => { noise.push(match); return ' '; });
  name = name.replace(DELIMITED_SCENE_NOISE_PATTERN, (match) => { noise.push(match); return ' '; });
  name = name.replace(PREFIX_GROUP_PATTERN, ' ');
  name = name.replace(SUFFIX_GROUP_PATTERN, ' ');

  name = name.replace(LANGUAGE_PATTERN, (match, offset: number, full: string) => {
    const before = full.slice(0, offset);
    const after = full.slice(offset + match.length);
    const isDelimitedTag = /[([]\s*$/.test(before) && /^[^\])]*[)\]]/.test(after);
    if (!isDelimitedTag) return match;
    languages.push(match);
    return ' ';
  });
  name = name.replace(/\bMULTi\d*\b/gi, (match) => { languages.push(match); return ' '; });

  name = name.replace(DISC_PATTERN, (match) => { noise.push(match); return ' '; });
  name = name.replace(DEV_STAGE_PATTERN, (match) => { noise.push(match); return ' '; });
  name = removeKnownEditions(name, editions);
  name = name.replace(TAIL_EDITION_PATTERN, (_match, edition: string, offset: number, full: string) => {
    const baseTitle = full.slice(0, offset).trim();
    if (!baseTitle) return _match;
    editions.push({ name: edition, known: true });
    return ' ';
  });
  const strippedNoiseEdition = new RegExp(`\\b(?:${NOISE_TAGS.join('|')})\\s+Edition\\b`, 'gi');
  name = name.replace(strippedNoiseEdition, (match) => { noise.push(match); return ' '; });
  name = removeUnknownEditionSuffix(name, editions);
  name = name.replace(VERSION_STRIP_PATTERN, ' ');
  name = name.replace(OPAQUE_RELEASE_SUFFIX_PATTERN, (match) => { noise.push(match.trim()); return ' '; });
  name = name.replace(BUILD_PATTERN, (match) => { noise.push(match); return ' '; });
  name = name.replace(/\b(?:19|20)\d{2}[._-]\d{1,2}[._-]\d{1,2}\b/g, (match) => { noise.push(match); return ' '; });
  const yearResult = getDelimitedYear(name);
  name = yearResult.title;

  name = name.replace(DLC_TAIL_PATTERN, ' ');
  const noisePattern = new RegExp(NOISE_PATTERN.source, 'gi');
  name = name.replace(noisePattern, (match) => { noise.push(match); return ' '; });
  name = name.replace(SUFFIX_SCENE_NOISE_PATTERN, (match) => { noise.push(match.trim()); return ' '; });
  name = name.replace(LANGUAGE_SUFFIX_PATTERN, (match) => { languages.push(match.trim()); return ' '; });
  if (editions.some((edition) => edition.known)) name = name.replace(/[\s:;,.!?+*–—-]+$/gu, ' ');

  const platformTail = tailTagPattern(PLATFORM_TAGS);
  name = name.replace(platformTail, (match) => { platform = match.trim(); noise.push(match.trim()); return ' '; });
  const regionPattern = new RegExp(`[([]\\s*(?:${escapeVocabulary(REGION_TAGS)})\\s*[)\\]]`, 'gi');
  name = name.replace(regionPattern, (match) => { region = match.replace(/[()[\]]/g, '').trim(); noise.push(match); return ' '; });

  name = name.replace(/\(\s*\)|\[\s*\]/g, ' ').replace(MULTI_WHITESPACE, ' ').trim();
  name = name.replace(/[\s,:;–—-]+$/gu, '').trim();

  return {
    baseTitle: name,
    ...(yearResult.year !== undefined ? { year: yearResult.year } : {}),
    ...(version ? { version } : {}),
    ...(group ? { group } : {}),
    ...(platform ? { platform } : {}),
    ...(region ? { region } : {}),
    dlcs,
    editions,
    languages,
    noise,
  };
}
