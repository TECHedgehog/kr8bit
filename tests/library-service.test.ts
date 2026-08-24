import { describe, it, expect } from 'vitest';
import { ValidationError } from '../src/shared/errors.js';
import { parseListFilter, sanitizeGamePatch } from '../src/modules/library/library.service.js';

describe('parseListFilter', () => {
  it('returns defaults', () => {
    expect(parseListFilter({})).toEqual({ limit: 50, offset: 0 });
  });

  it('uses custom limit and offset', () => {
    expect(parseListFilter({ limit: '10', offset: '5' })).toEqual({ limit: 10, offset: 5 });
  });

  it('caps limit at 200', () => {
    expect(parseListFilter({ limit: '500' })).toEqual({ limit: 200, offset: 0 });
  });

  it('rejects invalid limit values', () => {
    expect(() => parseListFilter({ limit: '0' })).toThrow(ValidationError);
    expect(() => parseListFilter({ limit: '-1' })).toThrow(ValidationError);
    expect(() => parseListFilter({ limit: 'abc' })).toThrow(ValidationError);
  });

  it('rejects invalid offset values', () => {
    expect(() => parseListFilter({ offset: '-1' })).toThrow(ValidationError);
    expect(() => parseListFilter({ offset: 'abc' })).toThrow(ValidationError);
  });

  it('trims search and drops empty string', () => {
    expect(parseListFilter({ search: '  foo  ' })).toEqual({ search: 'foo', limit: 50, offset: 0 });
    expect(parseListFilter({ search: '   ' })).toEqual({ limit: 50, offset: 0 });
  });
});

describe('sanitizeGamePatch', () => {
  it('returns empty patch for empty object', () => {
    expect(sanitizeGamePatch({})).toEqual({});
  });

  it('returns empty patch for null', () => {
    expect(sanitizeGamePatch(null)).toEqual({});
  });

  it('includes title string', () => {
    expect(sanitizeGamePatch({ title: 'Title' })).toEqual({ title: 'Title' });
  });

  it('includes title null', () => {
    expect(sanitizeGamePatch({ title: null })).toEqual({ title: null });
  });

  it('includes releaseYear number', () => {
    expect(sanitizeGamePatch({ releaseYear: 2020 })).toEqual({ releaseYear: 2020 });
  });

  it('includes releaseYear null', () => {
    expect(sanitizeGamePatch({ releaseYear: null })).toEqual({ releaseYear: null });
  });

  it('rejects releaseYear out of range', () => {
    expect(() => sanitizeGamePatch({ releaseYear: 1900 })).toThrow(ValidationError);
    expect(() => sanitizeGamePatch({ releaseYear: 2200 })).toThrow(ValidationError);
  });

  it('stringifies array fields', () => {
    expect(
      sanitizeGamePatch({
        developers: ['A', 'B'],
        publishers: ['C'],
        genres: ['D', 'E'],
      }),
    ).toEqual({
      developers: ['A', 'B'],
      publishers: ['C'],
      genres: ['D', 'E'],
    });
  });

  it('ignores unknown fields', () => {
    expect(sanitizeGamePatch({ unknown: 'x' })).toEqual({});
  });

  it('ignores non-array developer values', () => {
    expect(sanitizeGamePatch({ developers: 'A' })).toEqual({});
  });
});
