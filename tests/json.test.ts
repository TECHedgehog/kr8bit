import { describe, it, expect } from 'vitest';
import { encodeArray, decodeArray } from '../src/shared/json.js';

describe('encodeArray', () => {
  it('encodes string array as JSON', () => {
    expect(encodeArray(['a', 'b'])).toBe('["a","b"]');
  });

  it('encodes empty array', () => {
    expect(encodeArray([])).toBe('[]');
  });

  it('encodes null-ish as empty array', () => {
    expect(encodeArray(null as unknown as string[])).toBe('[]');
  });

  it('preserves unicode', () => {
    expect(encodeArray(['日本語', 'Español'])).toBe('["日本語","Español"]');
  });
});

describe('decodeArray', () => {
  it('decodes JSON string array', () => {
    expect(decodeArray('["a","b"]')).toEqual(['a', 'b']);
  });

  it('returns empty for null', () => {
    expect(decodeArray(null)).toEqual([]);
  });

  it('returns empty for undefined', () => {
    expect(decodeArray(undefined)).toEqual([]);
  });

  it('returns empty for malformed JSON', () => {
    expect(decodeArray('not json')).toEqual([]);
  });

  it('returns empty for non-array JSON', () => {
    expect(decodeArray('{"a":1}')).toEqual([]);
  });

  it('coerces non-string members to strings', () => {
    expect(decodeArray('[1, 2, 3]')).toEqual(['1', '2', '3']);
  });

  it('preserves unicode', () => {
    expect(decodeArray('["日本語"]')).toEqual(['日本語']);
  });

  it('roundtrips with encodeArray', () => {
    const arr = ['a', 'b', 'c'];
    expect(decodeArray(encodeArray(arr))).toEqual(arr);
  });
});