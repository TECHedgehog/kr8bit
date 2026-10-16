import { config } from '../config/index.js';
import { MatchStatus } from './enums.js';
import type { SearchResult } from './types.js';

export interface MatchThresholds {
  acceptThreshold: number;
  flagThreshold: number;
}

export interface MatchDecision {
  status: MatchStatus;
  score: number;
  result: SearchResult | null;
}

export function decideMatch(
  results: SearchResult[],
  thresholds: MatchThresholds = config.match,
): MatchDecision {
  if (results.length === 0) {
    return { status: MatchStatus.PENDING, score: 0, result: null };
  }

  const sorted = [...results].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const top = sorted[0];
  const score = top.score ?? 0;

  if (score >= thresholds.acceptThreshold) {
    return { status: MatchStatus.ACCEPTED, score, result: top };
  }
  if (score >= thresholds.flagThreshold) {
    return { status: MatchStatus.FLAGGED, score, result: top };
  }
  if (score > 0) {
    return { status: MatchStatus.REJECTED, score, result: top };
  }
  return { status: MatchStatus.PENDING, score: 0, result: top };
}
