import { MatchStatus } from '../../shared/enums.js';
import type { SearchResult } from '../../shared/types.js';

export const ACCEPT_THRESHOLD = 90;
export const FLAG_THRESHOLD = 70;

export interface MatchDecision {
  status: MatchStatus;
  score: number;
  result: SearchResult | null;
}

export function decideMatch(results: SearchResult[]): MatchDecision {
  if (results.length === 0) {
    return { status: MatchStatus.PENDING, score: 0, result: null };
  }

  const top = results[0];
  const score = top.score ?? 0;

  if (score >= ACCEPT_THRESHOLD) {
    return { status: MatchStatus.ACCEPTED, score, result: top };
  }
  if (score >= FLAG_THRESHOLD) {
    return { status: MatchStatus.FLAGGED, score, result: top };
  }
  return { status: MatchStatus.PENDING, score, result: top };
}