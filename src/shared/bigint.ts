// Side-effect import: installs a BigInt JSON serializer so Prisma BigInt
// columns (e.g. Game.sizeBytes) serialize as numbers in API responses.
// Import once at process entry (src/main.ts).

// Side-effect import: installs a BigInt JSON serializer so Prisma BigInt
// columns (e.g. Game.sizeBytes) serialize as numbers in API responses.
// Import once at process entry (src/main.ts).

interface BigIntWithToJSON {
  toJSON(): number;
  valueOf(): bigint;
  toString(radix?: number): string;
  toLocaleString(): string;
}

const proto = BigInt.prototype as unknown as BigIntWithToJSON;

if (typeof proto.toJSON !== 'function') {
  Object.defineProperty(proto, 'toJSON', {
    value: function (): number {
      return Number(this.valueOf());
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}