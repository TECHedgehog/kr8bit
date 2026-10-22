import { config } from '../../config/index.js';
import { MatchStatus } from '../../shared/enums.js';
import { BatchJob } from '../../shared/batch-job.js';
import { resetGate } from '../database/reset-gate.js';
import { libraryRepository } from '../library/library.repository.js';
import type { Game } from '../library/library.types.js';
import { metadataService } from './metadata.service.js';

export interface MetadataFullRefreshJobDeps {
  delayMs: number;
  concurrency: number;
  sleep: (ms: number) => Promise<void>;
}

const defaultDeps: MetadataFullRefreshJobDeps = {
  delayMs: config.metadata.refreshDelayMs,
  concurrency: config.metadata.refreshConcurrency,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const MATCHED_STATUSES = new Set<MatchStatus>([
  MatchStatus.ACCEPTED,
  MatchStatus.FLAGGED,
  MatchStatus.MANUAL,
]);

export class MetadataFullRefreshJob extends BatchJob<Game> {
  constructor(deps: MetadataFullRefreshJobDeps = defaultDeps) {
    super({
      label: 'full metadata refresh',
      delayMs: deps.delayMs,
      concurrency: deps.concurrency,
      sleep: deps.sleep,
      canStart: () => !resetGate.isResetting(),
    });
  }

  protected async collect(): Promise<Game[]> {
    return (await libraryRepository.listAll()).filter((game) => MATCHED_STATUSES.has(game.matchStatus));
  }

  protected async process(game: Game): Promise<boolean> {
    return (await metadataService.refresh(game.id)) !== null;
  }
}

export const metadataFullRefreshJob = new MetadataFullRefreshJob();
