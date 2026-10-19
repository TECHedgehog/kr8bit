import { randomUUID } from 'node:crypto';
import { config } from '../../config/index.js';
import { BatchJob } from '../../shared/batch-job.js';
import type { DiagnosticReport, GameDiagnosis, ProblemGame } from './diagnostics.service.js';
import { createDiagnosticsService, type DiagnosticsService } from './diagnostics.service.js';

export interface DiagnosticsJobStatus {
  runId: string | null;
  running: boolean;
  processed: number;
  total: number | null;
  failed: number;
  reportReady: boolean;
  completedAt: string | null;
  error: string | null;
}

export class DiagnosticsJob {
  private runId: string | null = null;
  private running = false;
  private processed = 0;
  private total: number | null = null;
  private failed = 0;
  private completedAt: string | null = null;
  private error: string | null = null;
  private report: DiagnosticReport | null = null;

  constructor(private readonly service: DiagnosticsService) {}

  isRunning(): boolean {
    return this.running;
  }

  start(): { started: boolean; runId: string | null } {
    if (this.running) return { started: false, runId: this.runId };
    this.running = true;
    this.runId = randomUUID();
    this.processed = 0;
    this.total = null;
    this.failed = 0;
    this.completedAt = null;
    this.error = null;
    this.report = null;
    void this.execute();
    return { started: true, runId: this.runId };
  }

  status(): DiagnosticsJobStatus {
    return {
      runId: this.runId,
      running: this.running,
      processed: this.processed,
      total: this.total,
      failed: this.failed,
      reportReady: this.report !== null,
      completedAt: this.completedAt,
      error: this.error,
    };
  }

  result(): DiagnosticReport | null {
    return this.report;
  }

  private async execute(): Promise<void> {
    try {
      const preparation = await this.service.prepare();
      this.total = preparation.problemGames.length;
      const results: GameDiagnosis[] = [];
      const service = this.service;
      const onProcessed = (failed: boolean) => {
        this.processed += 1;
        if (failed) this.failed += 1;
      };
      const batch = new class extends BatchJob<ProblemGame> {
        constructor() {
          super({
            label: 'diagnostics',
            delayMs: config.metadata.retryDelayMs,
            concurrency: config.metadata.retryConcurrency,
            sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
          });
        }

        protected async collect(): Promise<ProblemGame[]> {
          return preparation.problemGames;
        }

        protected async process(problem: ProblemGame): Promise<boolean> {
          let failed = false;
          try {
            results.push(await service.diagnose(problem));
          } catch (error) {
            failed = true;
            results.push({
              gameId: problem.game.id,
              entryName: problem.game.entryName,
              matchStatus: problem.game.matchStatus,
              matchScore: problem.game.matchScore,
              steamAppId: problem.game.steamAppId,
              issues: [...problem.issues, 'diagnosis-error'],
              providerMatches: [],
              search: {
                query: '',
                providers: [],
                decision: { status: 'ERROR', score: 0, result: null, assessment: 'diagnosis failed' },
              },
              matchedMetadata: null,
              artworkProbes: [],
              error: error instanceof Error ? error.message : String(error),
            });
          }
          onProcessed(failed);
          return true;
        }
      }();
      await batch.start();
      this.report = service.createReport(preparation, results);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.running = false;
      this.completedAt = new Date().toISOString();
    }
  }
}

const JOB_RETENTION_MS = 60 * 60 * 1000;
const jobsByScope = new Map<string, { job: DiagnosticsJob; lastAccess: number }>();

export function diagnosticsJobForScope(scope?: string): DiagnosticsJob {
  const key = scope ?? 'production';
  const now = Date.now();
  for (const [existingKey, entry] of jobsByScope) {
    if (!entry.job.isRunning() && now - entry.lastAccess > JOB_RETENTION_MS) {
      jobsByScope.delete(existingKey);
    }
  }
  let entry = jobsByScope.get(key);
  if (!entry) {
    entry = { job: new DiagnosticsJob(createDiagnosticsService(scope)), lastAccess: now };
    jobsByScope.set(key, entry);
  }
  entry.lastAccess = now;
  return entry.job;
}
