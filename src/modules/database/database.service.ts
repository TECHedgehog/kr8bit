import { databaseRepository } from './database.repository.js';
import { resetGate } from './reset-gate.js';
import {
  cleanOrphanedProviderMatches,
  cleanStaleSteamAppIds,
} from './orphan-cleanup.js';
import { scannerService } from '../scanner/scanner.service.js';
import { metadataRefreshJob } from '../metadata/metadata-refresh.job.js';
import { retryMatchJob } from '../metadata/retry-match.job.js';
import { AppError } from '../../shared/errors.js';

export const databaseService = {
  async reset() {
    // A wipe while a scan or background job is iterating game rows would
    // corrupt their in-flight state; refuse instead.
    if (
      scannerService.isRunning() ||
      metadataRefreshJob.isRunning() ||
      retryMatchJob.isRunning()
    ) {
      throw new AppError(409, 'scan already running', 'SCAN_RUNNING');
    }
    if (!resetGate.begin()) {
      throw new AppError(409, 'database reset already in progress', 'RESET_RUNNING');
    }
    try {
      return await databaseRepository.wipeAll();
    } finally {
      resetGate.end();
    }
  },

  async cleanup(): Promise<{ orphanedProviderMatches: number; staleSteamAppIds: number }> {
    const [orphanedProviderMatches, staleSteamAppIds] = await Promise.all([
      cleanOrphanedProviderMatches(),
      cleanStaleSteamAppIds(),
    ]);
    return { orphanedProviderMatches, staleSteamAppIds };
  },
};
