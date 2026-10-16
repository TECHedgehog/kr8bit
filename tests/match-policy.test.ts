import { describe, it, expect } from 'vitest';
import { decideMatch } from '../src/shared/match-policy.js';
import { MatchStatus } from '../src/shared/enums.js';
import type { SearchResult } from '../src/shared/types.js';

const thresholds = { acceptThreshold: 85, flagThreshold: 70 };

describe('decideMatch', () => {
  it('returns PENDING with no results', () => {
    const decision = decideMatch([], thresholds);
    expect(decision.status).toBe(MatchStatus.PENDING);
    expect(decision.score).toBe(0);
    expect(decision.result).toBeNull();
  });

  it('uses caller-provided thresholds', () => {
    const decision = decideMatch([{ remoteId: '1', title: 'A', score: 88 }], {
      acceptThreshold: 90,
      flagThreshold: 80,
    });
    expect(decision.status).toBe(MatchStatus.FLAGGED);
  });

  it('returns ACCEPTED at the accept threshold', () => {
    const results: SearchResult[] = [{ remoteId: '1', title: 'A', score: 85 }];
    const decision = decideMatch(results, thresholds);
    expect(decision.status).toBe(MatchStatus.ACCEPTED);
    expect(decision.score).toBe(85);
    expect(decision.result?.remoteId).toBe('1');
  });

  it('returns FLAGGED at the flag threshold', () => {
    const decision = decideMatch([{ remoteId: '7', title: 'B', score: 70 }], thresholds);
    expect(decision.status).toBe(MatchStatus.FLAGGED);
    expect(decision.score).toBe(70);
  });

  it('returns REJECTED for positive scores below the flag threshold', () => {
    const decision = decideMatch([{ remoteId: '2', title: 'C', score: 50 }], thresholds);
    expect(decision.status).toBe(MatchStatus.REJECTED);
    expect(decision.score).toBe(50);
    expect(decision.result).not.toBeNull();
  });

  it('returns PENDING for score zero', () => {
    const decision = decideMatch([{ remoteId: '2', title: 'C', score: 0 }], thresholds);
    expect(decision.status).toBe(MatchStatus.PENDING);
    expect(decision.score).toBe(0);
  });

  it('uses score zero when result has no score', () => {
    const decision = decideMatch([{ remoteId: '1', title: 'A' }], thresholds);
    expect(decision.score).toBe(0);
    expect(decision.status).toBe(MatchStatus.PENDING);
  });

  it('sorts merged results from multiple providers', () => {
    const results: SearchResult[] = [
      { providerName: 'igdb', remoteId: '1', title: 'A', score: 45 },
      { providerName: 'steam', remoteId: '2', title: 'B', score: 92 },
      { providerName: 'igdb', remoteId: '3', title: 'C', score: 78 },
    ];
    const decision = decideMatch(results, thresholds);
    expect(decision.status).toBe(MatchStatus.ACCEPTED);
    expect(decision.score).toBe(92);
    expect(decision.result?.providerName).toBe('steam');
  });
});
