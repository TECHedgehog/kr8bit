import { logger } from '../../logger/index.js';
import { config } from '../../config/index.js';
import { MatchStatus, RE_MATCHABLE_STATUSES } from '../../shared/enums.js';
import { libraryRepository } from '../library/library.repository.js';
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
import { AppError } from '../../shared/errors.js';

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

type CandidateOutcome = 'added' | 'updated' | 'skipped';

const RE_MATCHABLE = new Set<MatchStatus>(RE_MATCHABLE_STATUSES);

export interface ScannerStatusSnapshot {
  runningRun: ScanRun | null;
  latest: ScanRun | null;
  isRunning: boolean;
  currentScanRunId: string | null;
}

export class ScannerService {
  private running = false;
  private currentRunId: string | null = null;

  constructor(private readonly deps: ScannerDeps = defaultDeps) {}

  isRunning(): boolean {
    return this.running;
  }

  currentScanRunId(): string | null {
    return this.currentRunId;
  }

  async status(): Promise<ScannerStatusSnapshot> {
    const [running, latest] = await Promise.all([
      scannerRepository.findRunning(),
      scannerRepository.findLatest(),
    ]);
    return {
      runningRun: running,
      latest,
      isRunning: this.running,
      currentScanRunId: this.currentRunId,
    };
  }

  async start(): Promise<ScanRun> {
    if (this.running) {
      throw new AppError(409, 'scan already running', 'SCAN_RUNNING');
    }
    if (resetGate.isResetting()) {
      throw new AppError(409, 'database reset in progress', 'RESET_RUNNING');
    }
    // Set the flag synchronously BEFORE the first await: two concurrent
    // POST /api/scanner/run calls must not both pass the guard while the
    // ScanRun row is being created.
    this.running = true;
    let run: ScanRun;
    try {
      run = await scannerRepository.create({ rootPath: this.deps.libraryRoot });
    } catch (err) {
      this.running = false;
      throw err;
    }
    this.currentRunId = run.id;
    logger.info({ runId: run.id, rootPath: this.deps.libraryRoot }, 'scan started');
    void this.executeScan(run).catch((err) => {
      logger.error({ runId: run.id, err: (err as Error).message }, 'scanner unexpected failure');
    });
    return run;
  }

  private async executeScan(run: ScanRun): Promise<void> {
    try {
      await this.scanLibrary(run);
    } finally {
      this.running = false;
      this.currentRunId = null;
    }
  }

  private async scanLibrary(run: ScanRun): Promise<void> {
    const rootPath = this.deps.libraryRoot;
    const runId = run.id;

    emitProgress({
      scanRunId: runId,
      phase: 'start',
      found: 0,
      added: 0,
      updated: 0,
      failed: 0,
    });

    let candidates: ScanCandidate[] = [];
    try {
      candidates = await scanLibraryRoot(rootPath, this.deps.reader, config.scan);
    } catch (err) {
      const message = (err as Error).message;
      logger.error({ runId, err: message }, 'scan failed during walk');
      await scannerRepository.update(runId, {
        status: 'FAILED',
        finishedAt: this.deps.now(),
        errors: [message],
      });
      emitProgress({
        scanRunId: runId,
        phase: 'done',
        found: 0,
        added: 0,
        updated: 0,
        failed: 1,
        message,
      });
      return;
    }

    let added = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const candidate of candidates) {
      emitProgress({
        scanRunId: runId,
        phase: 'candidate',
        found: candidates.length,
        added,
        updated,
        failed,
        currentEntry: candidate.entryName,
      });

      try {
        const outcome = await this.processCandidate(candidate);
        if (outcome === 'added') added += 1;
        else if (outcome === 'updated') updated += 1;

        emitProgress({
          scanRunId: runId,
          phase: 'matched',
          found: candidates.length,
          added,
          updated,
          failed,
          currentEntry: candidate.entryName,
        });
      } catch (err) {
        failed += 1;
        const message = (err as Error).message;
        errors.push(`${candidate.entryPath}: ${message}`);
        logger.warn({ runId, err: message, candidate }, 'scan: candidate failed');
        emitProgress({
          scanRunId: runId,
          phase: 'failed',
          found: candidates.length,
          added,
          updated,
          failed,
          currentEntry: candidate.entryName,
          message,
        });
      }
    }

    await scannerRepository.update(runId, {
      status: 'DONE',
      finishedAt: this.deps.now(),
      found: candidates.length,
      added,
      updated,
      failed,
      errors,
    });

    emitProgress({
      scanRunId: runId,
      phase: 'done',
      found: candidates.length,
      added,
      updated,
      failed,
    });

    logger.info({ runId, found: candidates.length, added, updated, failed }, 'scan done');

    const jobs = this.deps.jobs;
    if (jobs && !jobs.retryMatch.isRunning()) {
      void jobs.retryMatch.start();
    }
  }

  private async processCandidate(candidate: ScanCandidate): Promise<CandidateOutcome> {
    const existing = await libraryRepository.findByEntryPath(candidate.entryPath);

    if (existing) {
      if (existing.matchStatus === MatchStatus.ACCEPTED || existing.matchStatus === MatchStatus.MANUAL) {
        logger.debug({ entry: candidate.entryPath }, 'scan: skipping accepted/manual');
        return 'skipped';
      }
      if (!RE_MATCHABLE.has(existing.matchStatus)) {
        return 'skipped';
      }
    }

    const normalized = normalizeGameName(candidate.entryName);
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
    });

    await applyDecisionToGame(created.id, decision, this.deps.now());
    await eagerRefreshIfMatched(created.id, decision, this.deps);

    return 'added';
  }
}

export const scannerService = new ScannerService();
