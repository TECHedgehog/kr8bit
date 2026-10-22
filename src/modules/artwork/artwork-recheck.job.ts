import { config } from '../../config/index.js';
import { MatchStatus } from '../../shared/enums.js';
import { BatchJob } from '../../shared/batch-job.js';
import { resetGate } from '../database/reset-gate.js';
import { libraryRepository } from '../library/library.repository.js';
import type { Game } from '../library/library.types.js';
import { metadataService } from '../metadata/metadata.service.js';

export interface ArtworkRecheckJobDeps {
  delayMs: number;
  concurrency: number;
  sleep: (ms: number) => Promise<void>;
}

const defaultDeps: ArtworkRecheckJobDeps = {
  delayMs: config.metadata.refreshDelayMs,
  concurrency: config.metadata.refreshConcurrency,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const MATCHED_STATUSES = new Set<MatchStatus>([
  MatchStatus.ACCEPTED,
  MatchStatus.FLAGGED,
  MatchStatus.MANUAL,
]);

export class ArtworkRecheckJob extends BatchJob<Game> {
  constructor(deps: ArtworkRecheckJobDeps = defaultDeps) {
    super({
      label: 'artwork recheck',
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
    return metadataService.recheckArtwork(game.id);
  }
}

export const artworkRecheckJob = new ArtworkRecheckJob();
