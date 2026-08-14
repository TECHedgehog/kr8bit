import { config } from '../../config/index.js';
import { MatchStatus } from '../../shared/enums.js';
import type { SearchResult } from '../../shared/types.js';

export const ACCEPT_THRESHOLD = config.match.acceptThreshold;
export const FLAG_THRESHOLD = config.match.flagThreshold;

export interface MatchDecision {
  status: MatchStatus;
  score: number;
  result: SearchResult | null;
}

export function decideMatch(results: SearchResult[]): MatchDecision {
  if (results.length === 0) {
    return { status: MatchStatus.PENDING, score: 0, result: null };
  }

  const sorted = [...results].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const top = sorted[0];
  const score = top.score ?? 0;

  if (score >= ACCEPT_THRESHOLD) {
    return { status: MatchStatus.ACCEPTED, score, result: top };
  }
  if (score >= FLAG_THRESHOLD) {
    return { status: MatchStatus.FLAGGED, score, result: top };
  }
  if (score > 0) {
    return { status: MatchStatus.REJECTED, score, result: top };
  }
  return { status: MatchStatus.PENDING, score: 0, result: top };
}