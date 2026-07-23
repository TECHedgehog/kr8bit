import { logger } from '../../logger/index.js';
import { libraryRepository } from '../library/library.repository.js';
import { metadataService } from './metadata.service.js';

export interface RefreshJobState {
  running: boolean;
  processed: number;
  failed: number;
}

class MetadataRefreshJob {
  private running = false;
  private processed = 0;
  private failed = 0;

  isRunning(): boolean {
    return this.running;
  }

  state(): RefreshJobState {
    return {
      running: this.running,
      processed: this.processed,
      failed: this.failed,
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      logger.debug('metadata refresh already running');
      return;
    }

    this.running = true;
    this.processed = 0;
    this.failed = 0;

    try {
      const games = await libraryRepository.findEligibleForRefresh();
      if (games.length === 0) {
        logger.debug('metadata refresh: no eligible games');
        return;
      }

      logger.info({ count: games.length }, 'metadata refresh started');

      for (const game of games) {
        try {
          const refreshed = await metadataService.refresh(game.id);
          if (refreshed) {
            this.processed += 1;
            logger.info({ gameId: game.id }, 'metadata refreshed');
          } else {
            this.failed += 1;
            logger.warn({ gameId: game.id }, 'metadata refresh returned null');
          }
        } catch (err) {
          this.failed += 1;
          logger.warn(
            { gameId: game.id, err: (err as Error).message },
            'metadata refresh failed for game',
          );
        }
      }

      logger.info(
        { processed: this.processed, failed: this.failed },
        'metadata refresh done',
      );
    } catch (err) {
      logger.error(
        { err: (err as Error).message },
        'metadata refresh unexpected failure',
      );
    } finally {
      this.running = false;
    }
  }
}

export const metadataRefreshJob = new MetadataRefreshJob();
