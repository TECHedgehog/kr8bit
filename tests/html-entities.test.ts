import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from '../src/shared/html-entities.js';

describe('decodeHtmlEntities', () => {
  it('decodes decimal and hexadecimal numeric entities', () => {
    expect(decodeHtmlEntities('Heroes&#8217; Vow &#x2013; v2')).toBe('Heroes’ Vow – v2');
  });

  it('decodes common named entities and nested escapes', () => {
    expect(decodeHtmlEntities('Rock &amp; Roll &mdash; &hellip; &amp;#8217;')).toBe('Rock & Roll — … ’');
  });

  it('preserves unknown and invalid entities', () => {
    expect(decodeHtmlEntities('&unknown; &#x110000;')).toBe('&unknown; &#x110000;');
  });
});
