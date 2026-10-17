export type ScanProgressStage = 'scan' | 'metadata' | 'artwork' | 'done';

export type ScanEntryOutcome = 'added' | 'updated' | 'skipped';

export interface ScanProgressEvent {
  scope?: string;
  scanRunId: string;
  phase: 'start' | 'candidate' | 'matched' | 'failed' | 'done';
  stage?: ScanProgressStage;
  total?: number;
  completed?: number;
  found: number;
  added: number;
  updated: number;
  failed: number;
  currentEntry?: string;
  message?: string;
}

interface ScanProgressCounts {
  found: number;
  added: number;
  updated: number;
  failed: number;
}

interface ScanTimelineOptions {
  scanRunId: string;
  emit: (event: ScanProgressEvent) => void;
  scope?: string;
  pace?: () => Promise<void>;
}

export function createScanTimeline({ scanRunId, scope, emit, pace = async () => {} }: ScanTimelineOptions) {
  let total = 0;
  let completed = 0;
  const counts: ScanProgressCounts = { found: 0, added: 0, updated: 0, failed: 0 };

  function emitStage(phase: ScanProgressEvent['phase'], stage: ScanProgressStage, currentEntry?: string, message?: string): void {
    emit({
      scope,
      scanRunId,
      phase,
      stage,
      total,
      completed,
      ...counts,
      ...(currentEntry === undefined ? {} : { currentEntry }),
      ...(message === undefined ? {} : { message }),
    });
  }

  async function emitEntryTail(entryName: string): Promise<void> {
    await pace();
    emitStage('matched', 'artwork', entryName);
    await pace();
    emitStage('matched', 'scan', entryName);
  }

  return {
    started(): void {
      emitStage('start', 'scan');
    },

    candidatesFound(found: number): void {
      total = found;
      emitStage('start', 'metadata');
      emitStage('start', 'artwork');
      counts.found = found;
      emitStage('candidate', 'scan');
    },

    entryStarted(entryName: string): void {
      emitStage('candidate', 'metadata', entryName);
    },

    async entryMatched(outcome: ScanEntryOutcome, entryName: string): Promise<void> {
      if (outcome === 'added') counts.added += 1;
      if (outcome === 'updated') counts.updated += 1;
      completed += 1;
      emitStage('matched', 'metadata', entryName);
      await emitEntryTail(entryName);
    },

    async entryFailed(entryName: string, message: string): Promise<void> {
      counts.failed += 1;
      completed += 1;
      emitStage('failed', 'metadata', entryName, message);
      await emitEntryTail(entryName);
    },

    walkFailed(): void {
      counts.failed += 1;
    },

    counts(): ScanProgressCounts {
      return { ...counts };
    },

    finished(message?: string): void {
      emitStage('done', 'done', undefined, message);
    },
  };
}
