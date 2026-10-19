import { normalizeForMatch } from './normalize.js';
import type { SearchResult } from './types.js';

function matchTokens(title: string): string[] {
  return normalizeForMatch(title.replace(/&/g, ' and ')).split(' ').filter(Boolean);
}

export function scoreTitleMatch(query: string, candidate: string): number {
  const queryTokens = new Set(matchTokens(query));
  const candidateTokens = new Set(matchTokens(candidate));
  if (queryTokens.size === 0 || candidateTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) overlap += 1;
  }

  return Math.round((2 * overlap / (queryTokens.size + candidateTokens.size)) * 100);
}

export function scoreSearchResults(
  query: string,
  results: SearchResult[],
  baseQuery = query,
): SearchResult[] {
  return results.map((result) => ({
    ...result,
    score: Math.max(
      result.score ?? 0,
      scoreTitleMatch(query, result.title),
      scoreTitleMatch(baseQuery, result.title),
    ),
  }));
}
