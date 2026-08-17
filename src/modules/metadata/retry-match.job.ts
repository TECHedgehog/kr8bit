import { logger } from '../../logger/index.js';
import { config } from '../../config/index.js';
import { libraryRepository } from '../library/library.repository.js';
import { providerRegistry } from './provider-registry.js';
import { normalizeGameName } from '../../shared/normalize.js';
import { decideMatch } from '../scanner/match-policy.js';
import { applyMatchResult } from '../scanner/match-apply.js';
import { metadataRefreshJob } from './metadata-refresh.job.js';
import { metadataService } from './metadata.service.js';
import { MatchStatus } from '../../shared/enums.js';
import type { SearchResult } from '../../shared/types.js';

export interface RetryMatchJobState {
  running: boolean;
  processed: number;
  failed: number;
  succeeded: string[];
  failedIds: string[];
}

export interface RetryMatchJobDeps {
  now: () => Date;
  delayMs: number;
  concurrency: number;
  sleep: (ms: number) => Promise<void>;
  metadataRefresh: { refresh: (gameId: string) => Promise<void> };
}

export const defaultRetryMatchJobDeps: RetryMatchJobDeps = {
  now: () => new Date(),
  delayMs: config.metadata.retryDelayMs,
  concurrency: config.metadata.retryConcurrency,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  metadataRefresh: {
    refresh: async (gameId: string) => {
      await metadataService.refresh(gameId);
    },
  },
};

export class RetryMatchJob {
  private running = false;
  private processed = 0;
  private failed = 0;
  private succeededIds: string[] = [];
  private failedIdsList: string[] = [];

  constructor(private readonly deps: RetryMatchJobDeps = defaultRetryMatchJobDeps) {}

  isRunning(): boolean {
    return this.running;
  }

  state(): RetryMatchJobState {
    return {
      running: this.running,
      processed: this.processed,
      failed: this.failed,
      succeeded: this.succeededIds,
      failedIds: this.failedIdsList,
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      logger.debug('retry-match already running');
      return;
    }

    this.running = true;
    this.processed = 0;
    this.failed = 0;
    this.succeededIds = [];
    this.failedIdsList = [];

    try {
      const games = await libraryRepository.findPendingGames();
      if (games.length === 0) {
        logger.debug('retry-match: no pending games');
        return;
      }

      logger.info({ count: games.length, concurrency: this.deps.concurrency }, 'retry-match started');

      const providers = providerRegistry.order();

      for (let i = 0; i < games.length; i += this.deps.concurrency) {
        const chunk = games.slice(i, i + this.deps.concurrency);
        const results = await Promise.all(
          chunk.map(async (game) => {
            try {
              const normalized = normalizeGameName(game.entryName);
              let searchResults: SearchResult[] = [];

              for (const provider of providers) {
                try {
                  const partial = await provider.search(normalized.query);
                  searchResults.push(...partial);
                } catch (err) {
                  logger.warn(
                    { err: (err as Error).message, provider: provider.name, gameId: game.id },
                    'retry-match: provider search failed',
                  );
                  continue;
                }
              }

              const decision = decideMatch(searchResults);
              const topResult = decision.result;
              const now = this.deps.now();

              const applied = topResult
                ? await applyMatchResult(game.id, decision, now)
                : false;
              if (!applied) {
                await libraryRepository.update(game.id, {
                  matchStatus: decision.status,
                  matchScore: decision.score,
                  matchedAt: now,
                });
              }

              if (applied && topResult) {
                logger.info(
                  { gameId: game.id, provider: topResult.providerName, score: decision.score },
                  'retry-match: matched',
                );

                if (decision.status === MatchStatus.ACCEPTED || decision.status === MatchStatus.FLAGGED) {
                  try {
                    await this.deps.metadataRefresh.refresh(game.id);
                  } catch (err) {
                    logger.debug(
                      { err: (err as Error).message, gameId: game.id },
                      'retry-match: eager metadata refresh failed',
                    );
                  }
                }

                return { id: game.id, ok: true as const };
              }
              logger.debug({ gameId: game.id }, 'retry-match: no match found');
              return { id: game.id, ok: false as const };
            } catch (err) {
              logger.warn(
                { gameId: game.id, err: (err as Error).message },
                'retry-match: failed for game',
              );
              return { id: game.id, ok: false as const };
            }
          }),
        );

        for (const r of results) {
          if (r.ok) {
            this.processed += 1;
            this.succeededIds.push(r.id);
          } else {
            this.failed += 1;
            this.failedIdsList.push(r.id);
          }
        }

        if (i + this.deps.concurrency < games.length) {
          await this.deps.sleep(this.deps.delayMs);
        }
      }

      logger.info(
        { processed: this.processed, failed: this.failed },
        'retry-match done',
      );

      if (!metadataRefreshJob.isRunning() && this.processed > 0) {
        void metadataRefreshJob.start();
      }
    } catch (err) {
      logger.error(
        { err: (err as Error).message },
        'retry-match unexpected failure',
      );
    } finally {
      this.running = false;
    }
  }
}

export const retryMatchJob = new RetryMatchJob();
