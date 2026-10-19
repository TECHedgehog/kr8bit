import { parseReleaseName } from './release-name.js';
import { MULTI_WHITESPACE } from './release-vocabulary.js';

const SEPARATOR_PATTERN = /[._]/g;
const GENERIC_EDITION_SUFFIX = /(?:\s*[:,;–—-]\s*)([\p{L}\p{N}][\p{L}\p{N}'’‘&-]*(?:\s+[\p{L}\p{N}'’‘&-]+)*\s+Edition)[\s*!?.–—-]*$/iu;
const BARE_EDITION_SUFFIX = /\s+Edition[\s*!?.–—-]*$/iu;

export interface NormalizedName {
  query: string;
  yearDetected?: number;
}

export function normalizeGameName(rawName: string): NormalizedName {
  const parsed = parseReleaseName(rawName);
  let name = parsed.baseTitle.replace(SEPARATOR_PATTERN, ' ');
  name = name.replace(/[^\p{L}\p{N}\s\-'":!&]/gu, ' ');
  name = name.replace(MULTI_WHITESPACE, ' ').trim();

  if (!name) name = rawName.replace(SEPARATOR_PATTERN, ' ').trim();

  return {
    query: name,
    yearDetected: parsed.year,
  };
}

/** Remove known release noise while preserving title case and punctuation. */
export function cleanGameTitle(rawName: string): string {
  let title = parseReleaseName(rawName).baseTitle;
  title = title.replace(/[^\p{L}\p{N}\s\-'’‘":!?,.&()+–—-]/gu, ' ');
  return title
    .replace(MULTI_WHITESPACE, ' ')
    .trim()
    .replace(/^[\s:;,.!?+*–—-]+|[\s:;,.?+*–—-]+$/gu, '')
    .trim();
}

/** Return base title when a colon/dash introduces an unknown edition phrase. */
export function stripEditionPhrase(title: string): string | null {
  const trimmedTitle = title.trim();
  const match = GENERIC_EDITION_SUFFIX.exec(trimmedTitle);
  const baseTitle = match && match.index !== undefined
    ? trimmedTitle.slice(0, match.index).trim().replace(/[\s:;,.!?+*–—-]+$/gu, '').trim()
    : trimmedTitle.replace(BARE_EDITION_SUFFIX, '').trim();
  if (baseTitle === trimmedTitle) return null;
  return baseTitle || null;
}

const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, ' ')
    .trim();
}
