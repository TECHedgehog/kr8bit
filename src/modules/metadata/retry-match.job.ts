import { logger } from '../../logger/index.js';
import { libraryRepository } from '../library/library.repository.js';
import { providerRegistry } from './provider-registry.js';
import { normalizeGameName } from '../scanner/name-normalizer.js';
import { decideMatch, FLAG_THRESHOLD } from '../scanner/match-policy.js';
import { applyMatchResult } from '../scanner/match-apply.js';
import { metadataRefreshJob } from './metadata-refresh.job.js';
import type { SearchResult } from '../../shared/types.js';

export interface RetryMatchJobState {
  running: boolean;
  processed: number;
  failed: number;
}

class RetryMatchJob {
  private running = false;
  private processed = 0;
  private failed = 0;

  isRunning(): boolean {
    return this.running;
  }

  state(): RetryMatchJobState {
    return {
      running: this.running,
      processed: this.processed,
      failed: this.failed,
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

    try {
      const games = await libraryRepository.findPendingGames();
      if (games.length === 0) {
        logger.debug('retry-match: no pending games');
        return;
      }

      logger.info({ count: games.length }, 'retry-match started');

      const providers = providerRegistry.order();

      for (const game of games) {
        try {
          const normalized = normalizeGameName(game.entryName);
          let results: SearchResult[] = [];

          for (const provider of providers) {
            try {
              results = await provider.search(normalized.query);
            } catch (err) {
              logger.warn(
                { err: (err as Error).message, provider: provider.name, gameId: game.id },
                'retry-match: provider search failed',
              );
              continue;
            }
            if (results.length > 0 && (results[0]?.score ?? 0) >= FLAG_THRESHOLD) {
              break;
            }
          }

          const decision = decideMatch(results);

          if (decision.result && await applyMatchResult(game.id, decision, new Date())) {
            this.processed += 1;
            logger.info(
              { gameId: game.id, provider: decision.result.providerName, score: decision.score },
              'retry-match: matched',
            );
          } else {
            this.failed += 1;
            logger.debug({ gameId: game.id }, 'retry-match: no match found');
          }
        } catch (err) {
          this.failed += 1;
          logger.warn(
            { gameId: game.id, err: (err as Error).message },
            'retry-match: failed for game',
          );
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
