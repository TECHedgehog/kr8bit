import { logger } from '../../logger/index.js';
import { config } from '../../config/index.js';
import { MatchStatus, RE_MATCHABLE_STATUSES, ScanStatus } from '../../shared/enums.js';
import { LIBRARY_MANUALLY_CLEARED_SETTING, libraryRepository } from '../library/library.repository.js';
import { scannerRepository } from './scanner.repository.js';
import type { ScanRun } from './scanner.types.js';
import { scanLibraryRoot, fsReader, type DirectoryReader, type ScanCandidate } from './folder-scanner.js';
import { normalizeGameName } from '../../shared/normalize.js';
import { decideMatch } from './match-policy.js';
import { searchAllProviders, applyDecisionToGame, eagerRefreshIfMatched } from './match-game.js';
import type { MetadataProvider } from '../../shared/types.js';
import { providerRegistry } from '../metadata/provider-registry.js';
import { metadataService } from '../metadata/metadata.service.js';
import { retryMatchJob } from '../metadata/retry-match.job.js';
import { resetGate } from '../database/reset-gate.js';
import { emitProgress } from './scanner.events.js';
import { createScanTimeline, type ScanEntryOutcome } from './scan-timeline.js';
import { AppError } from '../../shared/errors.js';
import { demoService } from '../demo/demo-service.js';
import { settingsRepository } from '../settings/settings.repository.js';
import { parseReleaseFilename } from '../../shared/parse-release-filename.js';
import { dirname } from 'node:path';

export interface ScannerDeps {
  providers: MetadataProvider[];
  reader: DirectoryReader;
  now: () => Date;
  libraryRoot: string;
  metadataRefresh: { refresh(gameId: string): Promise<unknown> };
  jobs?: {
    retryMatch: { isRunning(): boolean; start(): Promise<void> };
  };
}

export const defaultDeps: ScannerDeps = {
  providers: providerRegistry.order(),
  reader: fsReader,
  now: () => new Date(),
  libraryRoot: config.libraryRoot,
  metadataRefresh: metadataService,
  jobs: {
    retryMatch: retryMatchJob,
  },
};

const RE_MATCHABLE = new Set<MatchStatus>(RE_MATCHABLE_STATUSES);

export interface ScannerStatusSnapshot {
  runningRun: ScanRun | null;
  latest: ScanRun | null;
  isRunning: boolean;
  currentScanRunId: string | null;
  emptyReason: 'never-scanned' | 'manually-cleared' | null;
}

export class ScannerService {
  private readonly runningScopes = new Set<string>();
  private readonly currentRunIds = new Map<string, string>();
  private readonly stopRequested = new Set<string>();

  constructor(private readonly deps: ScannerDeps = defaultDeps) {}

  isRunning(): boolean {
    return this.runningScopes.size > 0;
  }

  currentScanRunId(): string | null {
    return this.currentRunIds.values().next().value ?? null;
  }

  async status(scope?: string): Promise<ScannerStatusSnapshot> {
    const key = scope ?? 'normal';
    const [running, latest, gameCount, manuallyCleared] = await Promise.all([
      scannerRepository.findRunning(scope),
      scannerRepository.findLatest(scope),
      libraryRepository.count(scope),
      settingsRepository.get(LIBRARY_MANUALLY_CLEARED_SETTING),
    ]);
    const emptyReason = gameCount > 0
      ? null
      : manuallyCleared === 'true'
        ? 'manually-cleared'
        : latest === null
          ? 'never-scanned'
          : null;
    return {
      runningRun: running,
      latest,
      isRunning: this.runningScopes.has(key),
      currentScanRunId: this.currentRunIds.get(key) ?? null,
      emptyReason,
    };
  }

  async start(scope?: string): Promise<ScanRun> {
    const key = scope ?? 'normal';
    if (this.runningScopes.has(key)) {
      throw new AppError(409, 'scan already running', 'SCAN_RUNNING');
    }
    if (resetGate.isResetting()) {
      throw new AppError(409, 'database reset in progress', 'RESET_RUNNING');
    }
    // Set the flag synchronously BEFORE the first await: two concurrent
    // POST /api/scanner/run calls must not both pass the guard while the
    // ScanRun row is being created.
    this.runningScopes.add(key);
    let run: ScanRun;
    try {
      run = await scannerRepository.create({ rootPath: scope ?? this.deps.libraryRoot, scope });
      await settingsRepository.set(LIBRARY_MANUALLY_CLEARED_SETTING, 'false');
    } catch (err) {
      this.runningScopes.delete(key);
      throw err;
    }
    this.currentRunIds.set(key, run.id);
    this.stopRequested.delete(run.id);
    logger.info({ runId: run.id, rootPath: this.deps.libraryRoot }, 'scan started');
    void this.executeScan(run, scope).catch((err) => {
      logger.error({ runId: run.id, err: (err as Error).message }, 'scanner unexpected failure');
    });
    return run;
  }

  requestStop(runId: string, scope?: string): void {
    const key = scope ?? 'normal';
    if (this.currentRunIds.get(key) !== runId || !this.runningScopes.has(key)) {
      throw new AppError(409, 'scan is not running', 'SCAN_NOT_RUNNING');
    }
    this.stopRequested.add(runId);
  }

  private async executeScan(run: ScanRun, scope?: string): Promise<void> {
    try {
       if (config.demoMode) await demoService.runScan(run, scope);
      else await this.scanLibrary(run);
    } finally {
      const key = scope ?? 'normal';
      this.runningScopes.delete(key);
      this.currentRunIds.delete(key);
      this.stopRequested.delete(run.id);
    }
  }

  private async scanLibrary(run: ScanRun): Promise<void> {
    const rootPath = this.deps.libraryRoot;
    const runId = run.id;
    const timeline = createScanTimeline({ scanRunId: runId, emit: emitProgress });
    timeline.started();

    let candidates: ScanCandidate[] = [];
    try {
      candidates = await scanLibraryRoot(rootPath, this.deps.reader, config.scan);
    } catch (err) {
      const message = (err as Error).message;
      logger.error({ runId, err: message }, 'scan failed during walk');
      timeline.walkFailed();
      await scannerRepository.update(runId, {
        status: 'FAILED',
        finishedAt: this.deps.now(),
        ...timeline.counts(),
        errors: [message],
      });
      timeline.finished(message);
      return;
    }

    const errors: string[] = [];
    timeline.candidatesFound(candidates.length);

    for (const candidate of candidates) {
      timeline.entryStarted(candidate.entryName);

      try {
        const outcome = await this.processCandidate(candidate);
        await timeline.entryMatched(outcome, candidate.entryName);
      } catch (err) {
        const message = (err as Error).message;
        errors.push(`${candidate.entryPath}: ${message}`);
        logger.warn({ runId, err: message, candidate }, 'scan: candidate failed');
        await timeline.entryFailed(candidate.entryName, message);
      }

      if (this.stopRequested.has(runId)) {
        const counts = timeline.counts();
        await scannerRepository.update(runId, {
          status: ScanStatus.CANCELLED,
          finishedAt: this.deps.now(),
          ...counts,
          errors,
        });
        timeline.finished('scan cancelled');
        logger.info({ runId, ...counts }, 'scan cancelled');
        return;
      }
    }

    const counts = timeline.counts();
    await scannerRepository.update(runId, {
      status: 'DONE',
      finishedAt: this.deps.now(),
      ...counts,
      errors,
    });

    timeline.finished();

    logger.info({ runId, ...counts }, 'scan done');

    const jobs = this.deps.jobs;
    if (jobs && !jobs.retryMatch.isRunning()) {
      void jobs.retryMatch.start();
    }
  }

  private async processCandidate(candidate: ScanCandidate): Promise<ScanEntryOutcome> {
    const normalized = normalizeGameName(candidate.entryName);
    const releaseInfo = parseReleaseFilename(candidate.entryName, candidate.entryType);
    const existing = await libraryRepository.findByEntryPath(candidate.entryPath)
      ?? await libraryRepository.findByTitleAndDirectory(normalized.query, dirname(candidate.entryPath));

    if (existing) {
      if (!existing.originalEntryName) {
        await libraryRepository.update(existing.id, {
          originalEntryName: candidate.entryName,
          releaseVersion: releaseInfo.version,
          releaseDlcs: releaseInfo.dlcs,
          releaseGroup: releaseInfo.group,
        });
      }
      if (existing.matchStatus === MatchStatus.ACCEPTED || existing.matchStatus === MatchStatus.MANUAL) {
        logger.debug({ entry: candidate.entryPath }, 'scan: skipping accepted/manual');
        return 'skipped';
      }
      if (!RE_MATCHABLE.has(existing.matchStatus)) {
        return 'skipped';
      }
    }

    const results = await searchAllProviders(normalized.query, this.deps.providers, {
      entry: candidate.entryPath,
    });
    const decision = decideMatch(results);

    if (existing) {
      const hadMatch = existing.steamAppId !== null || existing.title !== null;
      if (!decision.result && hadMatch) {
        logger.debug(
          { entry: candidate.entryPath, existingId: existing.id },
          'scan: preserving existing match on empty result',
        );
        return 'skipped';
      }
      await applyDecisionToGame(existing.id, decision, this.deps.now());
      await eagerRefreshIfMatched(existing.id, decision, this.deps);
      return 'updated';
    }

    const created = await libraryRepository.create({
      entryPath: candidate.entryPath,
      entryType: candidate.entryType,
      entryName: candidate.entryName,
      sizeBytes: candidate.sizeBytes,
      matchStatus: decision.status,
      originalEntryName: candidate.entryName,
      releaseVersion: releaseInfo.version,
      releaseDlcs: releaseInfo.dlcs,
      releaseGroup: releaseInfo.group,
    });

    await applyDecisionToGame(created.id, decision, this.deps.now());
    await eagerRefreshIfMatched(created.id, decision, this.deps);

    return 'added';
  }
}

export const scannerService = new ScannerService();
