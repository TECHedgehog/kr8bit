import { describe, it, expect } from 'vitest';
import { decideMatch, ACCEPT_THRESHOLD, FLAG_THRESHOLD } from '../src/modules/scanner/match-policy.js';
import { MatchStatus } from '../src/shared/enums.js';
import type { SearchResult } from '../src/shared/types.js';

describe('match-policy thresholds', () => {
  it('uses sensible bounds', () => {
    expect(ACCEPT_THRESHOLD).toBeGreaterThan(FLAG_THRESHOLD);
    expect(FLAG_THRESHOLD).toBeGreaterThan(0);
  });
});

describe('decideMatch', () => {
  it('returns PENDING with no results', () => {
    const d = decideMatch([]);
    expect(d.status).toBe(MatchStatus.PENDING);
    expect(d.score).toBe(0);
    expect(d.result).toBeNull();
  });

  it('returns ACCEPTED when top score >= 90', () => {
    const results: SearchResult[] = [{ remoteId: '1', title: 'A', score: 95 }];
    const d = decideMatch(results);
    expect(d.status).toBe(MatchStatus.ACCEPTED);
    expect(d.score).toBe(95);
    expect(d.result?.remoteId).toBe('1');
  });

  it('returns FLAGGED when 70 <= score < 90', () => {
    const results: SearchResult[] = [{ remoteId: '7', title: 'B', score: 80 }];
    const d = decideMatch(results);
    expect(d.status).toBe(MatchStatus.FLAGGED);
    expect(d.score).toBe(80);
  });

  it('returns PENDING when score < 70', () => {
    const results: SearchResult[] = [{ remoteId: '2', title: 'C', score: 50 }];
    const d = decideMatch(results);
    expect(d.status).toBe(MatchStatus.PENDING);
    expect(d.score).toBe(50);
    expect(d.result).not.toBeNull();
  });

  it('uses exactly 90 as accepted boundary', () => {
    expect(decideMatch([{ remoteId: '1', title: 'A', score: 90 }]).status).toBe(MatchStatus.ACCEPTED);
  });

  it('uses exactly 70 as flagged boundary', () => {
    expect(decideMatch([{ remoteId: '1', title: 'A', score: 70 }]).status).toBe(MatchStatus.FLAGGED);
  });

  it('uses score 0 when result has no score', () => {
    const d = decideMatch([{ remoteId: '1', title: 'A' }]);
    expect(d.score).toBe(0);
    expect(d.status).toBe(MatchStatus.PENDING);
  });
});