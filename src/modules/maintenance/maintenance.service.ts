import { artworkService } from '../artwork/artwork.service.js';
import { artworkRecheckJob } from '../artwork/artwork-recheck.job.js';
import { databaseRepository } from '../database/database.repository.js';
import { resetGate } from '../database/reset-gate.js';
import { metadataFullRefreshJob } from '../metadata/metadata-full-refresh.job.js';
import { metadataRefreshJob } from '../metadata/metadata-refresh.job.js';
import { retryMatchJob } from '../metadata/retry-match.job.js';
import { scannerService } from '../scanner/scanner.service.js';
import { AppError } from '../../shared/errors.js';

export interface RepackCatalogMaintenanceJob {
  isRunning(): boolean;
}

export function createMaintenanceService(repackCatalogJob: RepackCatalogMaintenanceJob) {
  function assertLibraryJobsIdle(): void {
    if (
      scannerService.isRunning()
      || metadataRefreshJob.isRunning()
      || retryMatchJob.isRunning()
      || metadataFullRefreshJob.isRunning()
      || artworkRecheckJob.isRunning()
    ) {
      throw new AppError(409, 'library job already running', 'JOB_RUNNING');
    }
  }

  function assertRefreshJobsIdle(): void {
    assertLibraryJobsIdle();
    if (repackCatalogJob.isRunning()) {
      throw new AppError(409, 'repack catalog job already running', 'JOB_RUNNING');
    }
  }

  function beginExclusiveAction(): void {
    if (!resetGate.begin()) {
      throw new AppError(409, 'maintenance action already in progress', 'RESET_RUNNING');
    }
  }

  async function runExclusive<T>(action: () => Promise<T>): Promise<T> {
    beginExclusiveAction();
    try {
      return await action();
    } finally {
      resetGate.end();
    }
  }

  function startJob(job: typeof metadataFullRefreshJob | typeof artworkRecheckJob) {
    if (resetGate.isResetting()) {
      throw new AppError(409, 'maintenance action already in progress', 'RESET_RUNNING');
    }
    assertRefreshJobsIdle();
    void job.start();
    return { started: true };
  }

  return {
    async wipeLibrary() {
      assertLibraryJobsIdle();
      return runExclusive(() => databaseRepository.wipeLibrary());
    },

    async wipeRepack() {
      if (repackCatalogJob.isRunning()) {
        throw new AppError(409, 'repack catalog job already running', 'JOB_RUNNING');
      }
      return runExclusive(() => databaseRepository.wipeRepack());
    },

    async clearArtworkCache() {
      assertLibraryJobsIdle();
      return runExclusive(async () => {
        await artworkService.clearAll();
        return { cleared: true };
      });
    },

    startMetadataRefresh() {
      return startJob(metadataFullRefreshJob);
    },

    startArtworkRecheck() {
      return startJob(artworkRecheckJob);
    },

    metadataRefreshStatus() {
      const state = metadataFullRefreshJob.state();
      return { running: state.running, processed: state.processed, failed: state.failed };
    },

    artworkRecheckStatus() {
      const state = artworkRecheckJob.state();
      return { running: state.running, processed: state.processed, failed: state.failed };
    },
  };
}

export type MaintenanceService = ReturnType<typeof createMaintenanceService>;
