import type { EntryType } from './enums.js';

export interface ParsedReleaseInfo {
  version: string | null;
  dlcs: string[];
  group: string | null;
}

const GROUP_PATTERN = /(?:\(|\[|\b)(fitgirl|dodi|elamigos|codex|rune|plaza|reloaded|goldberg|hoodlum|empress|skidrow)(?:\)|\]|\b)/i;
const VERSION_PATTERN = /\b(?:v|ver|version)[\s._-]*(\d+(?:[._]\d+)*)\b|\b(\d+(?:\.\d+){2,})\b/i;
const ARCHIVE_EXTENSION = /\.(?:7z|zip|rar|r\d{2,3}|part\d+\.rar|tar(?:\.gz)?|gz|bz2|xz|iso)$/i;
const NON_DLC_PLUS_SEGMENT = /^(?:update|patch|hotfix|build|repack)\b/i;

export function parseReleaseFilename(filename: string, entryType?: EntryType): ParsedReleaseInfo {
  const base = entryType === 'ARCHIVE' ? filename.replace(ARCHIVE_EXTENSION, '') : filename;
  const versionMatch = base.match(VERSION_PATTERN);
  const version = versionMatch ? (versionMatch[1] ?? versionMatch[2]).replace(/_/g, '.') : null;

  const dlcs = new Set<string>();
  for (const match of base.matchAll(/\bDLCs?\s*[:=-]\s*([^+()[\]]+)/gi)) {
    const value = match[1].trim();
    if (value && !NON_DLC_PLUS_SEGMENT.test(value)) dlcs.add(value.replace(/[._]+/g, ' '));
  }
  for (const match of base.matchAll(/\+\s*([^+()[\]]+)/g)) {
    const segment = match[1].trim();
    if (!segment || NON_DLC_PLUS_SEGMENT.test(segment)) continue;
    const value = segment.replace(/^DLCs?\s*[:=-]?\s*/i, '').trim();
    if (value && !/^DLCs?$/i.test(value)) dlcs.add(value.replace(/[._]+/g, ' '));
  }
  for (const match of base.matchAll(/\b(?:all|included|bonus)\s+DLCs?\b/gi)) dlcs.add(match[0]);

  return { version, dlcs: [...dlcs], group: base.match(GROUP_PATTERN)?.[1] ?? null };
}
