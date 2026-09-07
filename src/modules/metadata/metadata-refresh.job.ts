import { config } from '../../config/index.js';
import { BatchJob, type BatchJobState } from '../../shared/batch-job.js';
import { libraryRepository } from '../library/library.repository.js';
import type { Game } from '../library/library.types.js';
import { metadataService } from './metadata.service.js';
import { resetGate } from '../database/reset-gate.js';

export type RefreshJobState = BatchJobState;

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

export class MetadataRefreshJob extends BatchJob<Game> {
  constructor(deps: MetadataRefreshJobDeps = defaultMetadataRefreshJobDeps) {
    super({
      label: 'metadata refresh',
      delayMs: deps.delayMs,
      concurrency: deps.concurrency,
      sleep: deps.sleep,
      canStart: () => !resetGate.isResetting(),
    });
  }

  protected async collect(): Promise<Game[]> {
    return libraryRepository.findEligibleForRefresh();
  }

  protected async process(game: Game): Promise<boolean> {
    const refreshed = await metadataService.refresh(game.id);
    return refreshed !== null;
  }
}

export const metadataRefreshJob = new MetadataRefreshJob();
