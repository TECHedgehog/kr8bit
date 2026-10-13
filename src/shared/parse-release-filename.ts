export interface ParsedReleaseInfo {
  version: string | null;
  dlcs: string[];
  group: string | null;
}

const GROUP_PATTERN = /\b(fitgirl|dodi|elamigos|codex|rune|plaza|reloaded|goldberg|hoodlum|empress|skidrow|gog)\b/i;
const VERSION_PATTERNS = [
  /\b(?:v|ver|version)[\s._-]*(\d+(?:[._]\d+){1,5})\b/i,
  /\b(\d+\.\d+(?:\.\d+)*)\b/,
];

export function parseReleaseFilename(filename: string): ParsedReleaseInfo {
  const base = filename.replace(/\.[^.]+$/, '');
  let version: string | null = null;
  for (const pattern of VERSION_PATTERNS) {
    const match = base.match(pattern);
    if (match && !/^20\d{2}$/.test(match[1])) {
      version = match[1].replace(/_/g, '.');
      break;
    }
  }

  const dlcs = new Set<string>();
  for (const match of base.matchAll(/(?:\bDLCs?\b|\+)[\s:_-]*([^()[\]]+)/gi)) {
    const value = match[1].split(/\s{2,}|\b(?:v|version|repack)\b/i)[0].trim();
    if (value) dlcs.add(value.replace(/[._]+/g, ' '));
  }

  return { version, dlcs: [...dlcs], group: base.match(GROUP_PATTERN)?.[1] ?? null };
}
