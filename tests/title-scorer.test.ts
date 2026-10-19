import { describe, expect, it } from 'vitest';
import { scoreSearchResults, scoreTitleMatch } from '../src/shared/title-scorer.js';

describe('scoreTitleMatch', () => {
  it('treats ampersand and and as equivalent', () => {
    expect(scoreTitleMatch('Deer and Boy', 'Deer & Boy')).toBe(100);
  });

  it('scores punctuation variants identically', () => {
    expect(scoreTitleMatch('Black Myth - Wukong', 'Black Myth: Wukong')).toBe(100);
  });

  it('folds diacritics for equivalent title spellings', () => {
    expect(scoreTitleMatch('Bō: Path of the Teal Lotus', 'Bo - Path of the Teal Lotus')).toBe(100);
  });

  it('scores token overlap symmetrically', () => {
    expect(scoreTitleMatch('Black Myth', 'Black Myth: Wukong')).toBe(80);
  });

  it('returns zero for empty titles', () => {
    expect(scoreTitleMatch('', 'Game')).toBe(0);
  });
});

describe('scoreSearchResults', () => {
  it('uses best of provider, full-title, and base-title scores', () => {
    const results = scoreSearchResults('Black Myth - Wukong', [
      { providerName: 'steam', remoteId: '1', title: 'Black Myth: Wukong', score: 54 },
    ], 'Black Myth');

    expect(results[0].score).toBe(100);
  });
});
