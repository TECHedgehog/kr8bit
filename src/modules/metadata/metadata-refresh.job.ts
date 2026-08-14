import { logger } from '../../logger/index.js';
import { config } from '../../config/index.js';
import { libraryRepository } from '../library/library.repository.js';
import { metadataService } from './metadata.service.js';

export interface RefreshJobState {
  running: boolean;
  processed: number;
  failed: number;
  succeeded: string[];
  failedIds: string[];
}

export interface MetadataRefreshJobDeps {
  delayMs: number;
  concurrency: number;
  sleep: (ms: number) => Promise<void>;
}

export const defaultMetadataRefreshJobDeps: MetadataRefreshJobDeps = {
  delayMs: config.metadata.refreshDelayMs,
  concurrency: config.metadata.refreshConcurrency,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class MetadataRefreshJob {
  private running = false;
  private processed = 0;
  private failed = 0;
  private succeededIds: string[] = [];
  private failedIdsList: string[] = [];

  constructor(private readonly deps: MetadataRefreshJobDeps = defaultMetadataRefreshJobDeps) {}

  isRunning(): boolean {
    return this.running;
  }

  state(): RefreshJobState {
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
      logger.debug('metadata refresh already running');
      return;
    }

    this.running = true;
    this.processed = 0;
    this.failed = 0;
    this.succeededIds = [];
    this.failedIdsList = [];

    try {
      const games = await libraryRepository.findEligibleForRefresh();
      if (games.length === 0) {
        logger.debug('metadata refresh: no eligible games');
        return;
      }

      logger.info({ count: games.length, concurrency: this.deps.concurrency }, 'metadata refresh started');

      for (let i = 0; i < games.length; i += this.deps.concurrency) {
        const chunk = games.slice(i, i + this.deps.concurrency);
        const results = await Promise.all(
          chunk.map(async (game) => {
            try {
              const refreshed = await metadataService.refresh(game.id);
              if (refreshed) {
                logger.info({ gameId: game.id }, 'metadata refreshed');
                return { id: game.id, ok: true as const };
              }
              logger.warn({ gameId: game.id }, 'metadata refresh returned null');
              return { id: game.id, ok: false as const };
            } catch (err) {
              logger.warn(
                { gameId: game.id, err: (err as Error).message },
                'metadata refresh failed for game',
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
