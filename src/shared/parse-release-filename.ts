import type { EntryType } from './enums.js';
import { parseReleaseName } from './release-name.js';

export interface ParsedReleaseInfo {
  version: string | null;
  dlcs: string[];
  group: string | null;
}

export function parseReleaseFilename(filename: string, entryType?: EntryType): ParsedReleaseInfo {
  const parsed = parseReleaseName(filename, entryType ?? 'DIRECTORY');
  return { version: parsed.version ?? null, dlcs: parsed.dlcs, group: parsed.group ?? null };
}
