// Shared display formatters used across pages.

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

export function parseStringList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function joinStringList(values: string[]): string {
  return values.join(', ');
}

const ARCHIVE_EXTENSION_PATTERN = /\.(7z|zip|rar|r\d{2,3}|tar(\.gz)?|gz|bz2|xz|iso|exe|msi|bin)$/i;

export function stripArchiveExtension(name: string): string {
  return name.replace(ARCHIVE_EXTENSION_PATTERN, '');
}