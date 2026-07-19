const ARCHIVE_EXTENSION_PATTERN = /\.(7z|zip|rar|r\d{2,3}|tar(\.gz)?|gz|bz2|xz|iso|exe|msi|bin)$/i;

const TAG_PATTERNS: RegExp[] = [
  /\(repack[^)]*\)/gi,
  /\(fitgirl[^)]*\)/gi,
  /\[fitgirl[^\]]*\]/gi,
  /\(gog[^)]*\)/gi,
  /\(multi\d*\)/gi,
  /\bMULTi\d*\b/gi,
  /\(steamless[^)]*\)/gi,
  /\(iso\)/gi,
  /\(cracked\)/gi,
  /\(steam\s*rip[^)]*\)/gi,
  /\(codex\)/gi,
  /\(tforce\)/gi,
  /\(elamigos[^)]*\)/gi,
  /\(dodi[^)]*\)/gi,
  /\(onlinefix[^)]*\)/gi,
];

const NOISE_PATTERNS: RegExp[] = [
  /\bDLCs?\b/gi,
  /\bUpdate\s*[\d.]*\b/gi,
  /\bPatch\s*[\d.]*\b/gi,
  /\bBonus\b/gi,
  /\bOSt\b/gi,
  /\bSoundtrack\b/gi,
  /\bStrategy\s+Guide\b/gi,
];

const YEAR_PATTERN = /\b(19\d{2}|20\d{2})\b/g;
const VERSION_PATTERN = /\bv\d+(\.\d+)*\b/gi;
const BUILD_PATTERN = /\bbuild\s*\d+/gi;
const ISO_DISCORD_PATTERN = /[._]/g;
const MULTI_WHITESPACE = /\s+/g;

export interface NormalizedName {
  query: string;
  yearDetected?: number;
}

function stripTags(input: string): string {
  let out = input;
  for (const pattern of TAG_PATTERNS) {
    out = out.replace(pattern, ' ');
  }
  return out;
}

function stripNoise(input: string): string {
  let out = input;
  for (const pattern of NOISE_PATTERNS) {
    out = out.replace(pattern, ' ');
  }
  return out;
}

function extractYear(input: string): { cleaned: string; year?: number } {
  const matches = input.match(YEAR_PATTERN);
  if (!matches) return { cleaned: input };
  const candidates = matches
    .map(Number)
    .filter((y) => y >= 1980 && y <= new Date().getFullYear() + 1);
  if (candidates.length === 0) return { cleaned: input };
  const year = candidates.sort((a, b) => a - b)[candidates.length - 1];
  const cleaned = input.replace(String(year), ' ');
  return { cleaned, year };
}

export function normalizeGameName(rawName: string): NormalizedName {
  let name = rawName;

  name = name.replace(ARCHIVE_EXTENSION_PATTERN, '');

  name = stripTags(name);
  name = stripNoise(name);
  name = name.replace(VERSION_PATTERN, ' ');
  name = name.replace(BUILD_PATTERN, ' ');
  const yearResult = extractYear(name);
  name = yearResult.cleaned;

  name = name.replace(ISO_DISCORD_PATTERN, ' ');
  name = name.replace(/[^\p{L}\p{N}\s\-'":!&]/gu, ' ');
  name = name.replace(MULTI_WHITESPACE, ' ').trim();

  if (!name) name = rawName.replace(ISO_DISCORD_PATTERN, ' ').trim();

  return {
    query: name,
    yearDetected: yearResult.year,
  };
}