export function encodeArray(arr: string[]): string {
  return JSON.stringify(arr ?? []);
}

export function decodeArray(s: string | null | undefined): string[] {
  if (s == null) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}