import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';
import { BatchJob, type BatchJobState } from '../../shared/batch-job.js';
import { libraryRepository } from '../library/library.repository.js';
import type { Game } from '../library/library.types.js';
import { providerRegistry } from './provider-registry.js';
import { metadataRefreshJob } from './metadata-refresh.job.js';
import { metadataService } from './metadata.service.js';
import { matchGame, eagerRefreshIfMatched } from '../scanner/match-game.js';
import { resetGate } from '../database/reset-gate.js';

export type RetryMatchJobState = BatchJobState;

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

export class RetryMatchJob extends BatchJob<Game> {
  private readonly pipelineDeps: {
    providers: ReturnType<typeof providerRegistry.order>;
    now: () => Date;
    metadataRefresh: { refresh: (gameId: string) => Promise<void> };
  };

  constructor(deps: RetryMatchJobDeps = defaultRetryMatchJobDeps) {
    super({
      label: 'retry-match',
      delayMs: deps.delayMs,
      concurrency: deps.concurrency,
      sleep: deps.sleep,
      canStart: () => !resetGate.isResetting(),
    });
    this.pipelineDeps = {
      providers: providerRegistry.order(),
      now: deps.now,
      metadataRefresh: deps.metadataRefresh,
    };
  }

  protected async collect(): Promise<Game[]> {
    return libraryRepository.findPendingGames();
  }

  protected async process(game: Game): Promise<boolean> {
    const { decision, applied } = await matchGame(game, this.pipelineDeps);
    if (applied && decision.result) {
      logger.info(
        { gameId: game.id, provider: decision.result.providerName, score: decision.score },
        'retry-match: matched',
      );
      await eagerRefreshIfMatched(game.id, decision, this.pipelineDeps);
      return true;
    }
    logger.debug({ gameId: game.id }, 'retry-match: no match found');
    return false;
  }

  protected override async onDone(processed: number): Promise<void> {
    if (!metadataRefreshJob.isRunning() && processed > 0) {
      void metadataRefreshJob.start();
    }
  }
}

export const retryMatchJob = new RetryMatchJob();
