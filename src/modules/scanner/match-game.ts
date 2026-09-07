import { logger } from '../../logger/index.js';
import { MatchStatus } from '../../shared/enums.js';
import type { MetadataProvider, SearchResult } from '../../shared/types.js';
import type { Game } from '../library/library.types.js';
import { libraryRepository } from '../library/library.repository.js';
import { normalizeGameName } from '../../shared/normalize.js';
import { decideMatch, type MatchDecision } from './match-policy.js';
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
  const results: SearchResult[] = [];
  for (const provider of providers) {
    try {
      const partial = await provider.search(query);
      results.push(...partial);
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
): Promise<boolean> {
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
  const decision = decideMatch(results);
  const applied = await applyDecisionToGame(game.id, decision, deps.now());
  return { decision, applied };
}
