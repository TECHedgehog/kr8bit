import { describe, it, expect } from 'vitest';
import { ValidationError } from '../src/shared/errors.js';
import { parseListFilter, sanitizeGamePatch } from '../src/modules/library/library.service.js';

describe('parseListFilter', () => {
  it('returns defaults', () => {
    expect(parseListFilter({})).toEqual({ limit: 50, offset: 0, sort: 'title-asc' });
  });

  it('uses custom limit and offset', () => {
    expect(parseListFilter({ limit: '10', offset: '5' })).toEqual({ limit: 10, offset: 5, sort: 'title-asc' });
  });

  it('caps limit at 200', () => {
    expect(parseListFilter({ limit: '500' })).toEqual({ limit: 200, offset: 0, sort: 'title-asc' });
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
    expect(parseListFilter({ search: '  foo  ' })).toEqual({ search: 'foo', limit: 50, offset: 0, sort: 'title-asc' });
    expect(parseListFilter({ search: '   ' })).toEqual({ limit: 50, offset: 0, sort: 'title-asc' });
  });

  it('passes through valid sort', () => {
    expect(parseListFilter({ sort: 'newest' })).toEqual({ limit: 50, offset: 0, sort: 'newest' });
    expect(parseListFilter({ sort: 'title-desc' })).toEqual({ limit: 50, offset: 0, sort: 'title-desc' });
    expect(parseListFilter({ sort: 'largest' })).toEqual({ limit: 50, offset: 0, sort: 'largest' });
  });

  it('falls back to default sort on unknown value', () => {
    expect(parseListFilter({ sort: 'bogus' })).toEqual({ limit: 50, offset: 0, sort: 'title-asc' });
  });

  it('falls back to default sort on empty value', () => {
    expect(parseListFilter({ sort: '' })).toEqual({ limit: 50, offset: 0, sort: 'title-asc' });
  });

  it('parses single genre', () => {
    expect(parseListFilter({ genre: 'Action' })).toEqual({ genres: ['Action'], limit: 50, offset: 0, sort: 'title-asc' });
  });

  it('parses multiple genres', () => {
    expect(parseListFilter({ genre: 'Action,RPG' })).toEqual({ genres: ['Action', 'RPG'], limit: 50, offset: 0, sort: 'title-asc' });
  });

  it('trims and filters empty genre entries', () => {
    expect(parseListFilter({ genre: ' Action , , RPG ' })).toEqual({ genres: ['Action', 'RPG'], limit: 50, offset: 0, sort: 'title-asc' });
  });

  it('drops empty genre string', () => {
    expect(parseListFilter({ genre: '   ' })).toEqual({ limit: 50, offset: 0, sort: 'title-asc' });
  });

  it('parses single deck category', () => {
    expect(parseListFilter({ deck: '3' })).toEqual({ steamDeck: [3], limit: 50, offset: 0, sort: 'title-asc' });
  });

  it('parses multiple deck categories', () => {
    expect(parseListFilter({ deck: '3,2' })).toEqual({ steamDeck: [3, 2], limit: 50, offset: 0, sort: 'title-asc' });
  });

  it('parses deck category 0 (Unknown)', () => {
    expect(parseListFilter({ deck: '0' })).toEqual({ steamDeck: [0], limit: 50, offset: 0, sort: 'title-asc' });
  });

  it('rejects invalid deck values', () => {
    expect(() => parseListFilter({ deck: '4' })).toThrow(ValidationError);
    expect(() => parseListFilter({ deck: '-1' })).toThrow(ValidationError);
    expect(() => parseListFilter({ deck: 'abc' })).toThrow(ValidationError);
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
