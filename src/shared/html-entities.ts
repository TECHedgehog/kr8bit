const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', apos: "'", copy: '©', deg: '°', euro: '€', gt: '>', hellip: '…',
  laquo: '«', ldquo: '“', lsaquo: '‹', lsquo: '‘', lt: '<', mdash: '—',
  nbsp: ' ', ndash: '–', pound: '£', raquo: '»', rdquo: '”', reg: '®',
  rsaquo: '›', rsquo: '’', trade: '™', quot: '"',
};

function decodeEntity(entity: string, value: string): string {
  if (!value.startsWith('#')) {
    const name = value.toLowerCase();
    return Object.hasOwn(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : entity;
  }

  const hex = /^#x/i.test(value);
  const codePoint = Number.parseInt(value.slice(hex ? 2 : 1), hex ? 16 : 10);
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
    return entity;
  }
  return String.fromCodePoint(codePoint);
}

/** Decode common named HTML entities plus decimal/hex numeric entities. */
export function decodeHtmlEntities(input: string): string {
  let decoded = input;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][\da-z]+);/gi, (entity, value: string) => decodeEntity(entity, value));
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}
