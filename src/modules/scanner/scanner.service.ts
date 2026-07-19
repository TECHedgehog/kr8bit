import { logger } from '../../logger/index.js';
import { config } from '../../config/index.js';
import { MatchStatus } from '../../shared/enums.js';
import { libraryRepository } from '../library/library.repository.js';
import { scannerRepository } from './scanner.repository.js';
import type { ScanRun } from './scanner.types.js';
import { scanLibraryRoot, type DirectoryReader, type ScanCandidate } from './folder-scanner.js';
import { normalizeGameName } from './name-normalizer.js';
import { decideMatch } from './match-policy.js';
import type { MetadataProvider, SearchResult } from '../../shared/types.js';
import { steamProvider } from '../metadata/steam/steam.provider.js';
import { emitProgress } from './scanner.events.js';

export interface ScannerDeps {
  provider: MetadataProvider;
  reader: DirectoryReader;
  now: () => Date;
  libraryRoot: string;
}

export const defaultDeps: ScannerDeps = {
  provider: steamProvider,
  reader: {
    async readdir(path) {
      const { promises: fs } = await import('node:fs');
      return fs.readdir(path);
    },
    async stat(path) {
      const { promises: fs } = await import('node:fs');
      return fs.stat(path);
    },
  },
  now: () => new Date(),
  libraryRoot: config.libraryRoot,
};

type CandidateOutcome = 'added' | 'updated' | 'skipped';

const RE_MATCHABLE = new Set<MatchStatus>([
  MatchStatus.PENDING,
  MatchStatus.FLAGGED,
  MatchStatus.REJECTED,
]);

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

  async start(): Promise<ScanRun> {
    if (this.running) {
      throw new Error('scan already running');
    }
    const run = await scannerRepository.create({ rootPath: this.deps.libraryRoot });
    this.running = true;
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
      candidates = await scanLibraryRoot(rootPath, this.deps.reader);
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

    let results: SearchResult[] = [];
    try {
      results = await this.deps.provider.search(normalized.query);
    } catch (err) {
      logger.warn({ err: (err as Error).message, query: normalized.query }, 'scan: provider search failed');
      results = [];
    }

    const decision = decideMatch(results);

    if (existing) {
      const hadMatch = existing.steamAppId !== null;
      if (!decision.result && hadMatch) {
        logger.debug(
          { entry: candidate.entryPath, existing: existing.steamAppId },
          'scan: preserving existing match on empty result',
        );
        return 'skipped';
      }
      await libraryRepository.update(existing.id, {
        matchStatus: decision.status,
        matchScore: decision.score,
        matchedAt: this.deps.now(),
        steamAppId: decision.result ? Number(decision.result.remoteId) : null,
      });
      return 'updated';
    }

    const created = await libraryRepository.create({
      entryPath: candidate.entryPath,
      entryType: candidate.entryType,
      entryName: candidate.entryName,
      sizeBytes: candidate.sizeBytes,
      matchStatus: decision.status,
    });

    if (decision.result) {
      await libraryRepository.update(created.id, {
        matchScore: decision.score,
        matchedAt: this.deps.now(),
        steamAppId: Number(decision.result.remoteId),
      });
    }

    return 'added';
  }
}

export const scannerService = new ScannerService();