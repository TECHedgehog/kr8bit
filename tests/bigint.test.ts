import { describe, it, expect } from 'vitest';
import '../src/shared/bigint.js';

describe('BigInt JSON serialization', () => {
  it('serializes BigInt as number', () => {
    expect(JSON.stringify({ x: 10n })).toBe('{"x":10}');
  });

  it('does not wrap in quotes', () => {
    expect(JSON.stringify({ x: 10n })).not.toContain('"10"');
  });

  it('preserves value magnitude for representable numbers', () => {
    expect(JSON.stringify({ x: 1n })).toBe('{"x":1}');
  });

  it('is idempotent across multiple imports', async () => {
    // Re-importing should not overwrite the serializer (toJSON already defined)
    await import('../src/shared/bigint.js');
    expect(JSON.stringify({ x: 5n })).toBe('{"x":5}');
  });
});