import { logger } from '../../logger/index.js';
import { config } from '../../config/index.js';
import { MatchStatus } from '../../shared/enums.js';
import type { MetadataProvider, SearchResult } from '../../shared/types.js';
import { decideMatch, type MatchDecision } from '../../shared/match-policy.js';
import type { Game } from '../library/library.types.js';
import { libraryRepository } from '../library/library.repository.js';
import { normalizeGameName, stripEditionPhrase } from '../../shared/normalize.js';
import { scoreSearchResults } from '../../shared/title-scorer.js';
import { applyMatchResult } from './match-apply.js';

export interface MatchPipelineDeps {
  providers: MetadataProvider[];
  now: () => Date;
  metadataRefresh: { refresh(gameId: string): Promise<unknown> };
}

/** Query every provider, tolerating individual provider failures. */
export async function searchAllProviders(
  query: string,
  providers: MetadataProvider[],
  logContext: Record<string, unknown> = {},
): Promise<SearchResult[]> {
  let results = await searchProvidersForQuery(query, providers, logContext);
  const fallbackQueries = getFallbackQueries(query);
  for (const fallbackQuery of fallbackQueries) {
    if (results.length > 0) break;
    results = await searchProvidersForQuery(fallbackQuery, providers, {
      ...logContext,
      fallbackQuery,
    });
  }

  const baseQuery = fallbackQueries.at(-1) ?? stripEditionPhrase(query) ?? query;
  return scoreSearchResults(query, results, baseQuery);
}

async function searchProvidersForQuery(
  query: string,
  providers: MetadataProvider[],
  logContext: Record<string, unknown>,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  for (const provider of providers) {
    try {
      results.push(...await provider.search(query));
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, provider: provider.name, query, ...logContext },
        'provider search failed',
      );
    }
  }
  return results;
}

/**
 * Apply a match decision to an existing game: persist provider match +
 * status via applyMatchResult, or fall back to a bare status update when
 * no provider match applies. Returns true when a provider match was stored.
 */
export async function applyDecisionToGame(
  gameId: string,
  decision: MatchDecision,
  now: Date,
  hasExistingMatch = false,
): Promise<boolean> {
  if (!decision.result && hasExistingMatch) {
    logger.debug({ gameId }, 'match retry: preserving existing match on empty result');
    return false;
  }

  const applied = decision.result
    ? await applyMatchResult(gameId, decision, now)
    : false;
  if (!applied) {
    await libraryRepository.update(gameId, {
      matchStatus: decision.status,
      matchScore: decision.score,
      matchedAt: now,
    });
  }
  return applied;
}

/**
 * Eagerly refresh metadata (artwork + DB fields) right after an
 * accepted/flagged match. Best-effort: failures are logged, not thrown.
 */
export async function eagerRefreshIfMatched(
  gameId: string,
  decision: MatchDecision,
  deps: MatchPipelineDeps,
): Promise<void> {
  if (!decision.result) return;
  if (decision.status !== MatchStatus.ACCEPTED && decision.status !== MatchStatus.FLAGGED) return;
  try {
    await deps.metadataRefresh.refresh(gameId);
  } catch (err) {
    logger.debug(
      { err: (err as Error).message, gameId },
      'eager metadata refresh failed',
    );
  }
}

/** Full pipeline for one existing game: normalize → search → decide → apply. */
export async function matchGame(
  game: Game,
  deps: MatchPipelineDeps,
): Promise<{ decision: MatchDecision; applied: boolean }> {
  const normalized = normalizeGameName(game.entryName);
  const results = await searchAllProviders(normalized.query, deps.providers, { gameId: game.id });
  const decision = decideMatch(results, config.match);
  const hasExistingMatch = game.steamAppId !== null
    || game.title !== null
    || game.matchStatus === MatchStatus.FLAGGED
    || game.matchStatus === MatchStatus.ACCEPTED;
  const applied = await applyDecisionToGame(game.id, decision, deps.now(), hasExistingMatch);
  return { decision, applied };
}

function getFallbackQueries(query: string): string[] {
  const candidates = [
    stripEditionPhrase(query),
    query.split(/\s+[–—-]\s+/u, 2)[0]?.trim() ?? null,
  ];
  return [...new Set(candidates.filter((candidate): candidate is string =>
    !!candidate && candidate.length > 0 && candidate !== query,
  ))];
}
