import { logger } from '../logger/index.js';

export interface BatchJobState {
  running: boolean;
  processed: number;
  failed: number;
  succeeded: string[];
  failedIds: string[];
}

export interface BatchJobOptions {
  /** Log/error context label, e.g. 'metadata refresh'. */
  label: string;
  delayMs: number;
  concurrency: number;
  sleep: (ms: number) => Promise<void>;
  /** Extra start guard (e.g. database reset gate); job skips when false. */
  canStart?: () => boolean;
}

/**
 * Shared skeleton for chunked background jobs: collect work items, process
 * them in concurrency-sized chunks with a delay between chunks, track
 * per-item success/failure, and never run twice concurrently.
 */
export abstract class BatchJob<T extends { id: string }> {
  private running = false;
  private processed = 0;
  private failed = 0;
  private succeededIds: string[] = [];
  private failedIdsList: string[] = [];

  constructor(private readonly options: BatchJobOptions) {}

  isRunning(): boolean {
    return this.running;
  }

  state(): BatchJobState {
    return {
      running: this.running,
      processed: this.processed,
      failed: this.failed,
      succeeded: this.succeededIds,
      failedIds: this.failedIdsList,
    };
  }

  async start(): Promise<void> {
    const { label } = this.options;
    if (this.running) {
      logger.debug(`${label} already running`);
      return;
    }
    if (this.options.canStart && !this.options.canStart()) {
      logger.debug(`${label} skipped: start guard refused`);
      return;
    }

    this.running = true;
    this.processed = 0;
    this.failed = 0;
    this.succeededIds = [];
    this.failedIdsList = [];

    try {
      const items = await this.collect();
      if (items.length === 0) {
        logger.debug(`${label}: no work`);
        return;
      }

      logger.info({ count: items.length, concurrency: this.options.concurrency }, `${label} started`);

      for (let i = 0; i < items.length; i += this.options.concurrency) {
        const chunk = items.slice(i, i + this.options.concurrency);
        const results = await Promise.all(
          chunk.map(async (item) => {
            try {
              const ok = await this.process(item);
              if (ok) {
                logger.info({ id: item.id }, `${label}: item processed`);
              } else {
                logger.warn({ id: item.id }, `${label}: item not processed`);
              }
              return { id: item.id, ok };
            } catch (err) {
              logger.warn(
                { id: item.id, err: (err as Error).message },
                `${label}: item failed`,
              );
              return { id: item.id, ok: false as const };
            }
          }),
        );

        for (const r of results) {
          if (r.ok) {
            this.processed += 1;
            this.succeededIds.push(r.id);
          } else {
            this.failed += 1;
            this.failedIdsList.push(r.id);
          }
        }

        if (i + this.options.concurrency < items.length) {
          await this.options.sleep(this.options.delayMs);
        }
      }

      logger.info(
        { processed: this.processed, failed: this.failed },
        `${label} done`,
      );
      await this.onDone?.(this.processed, this.failed);
    } catch (err) {
      logger.error(
        { err: (err as Error).message },
        `${label} unexpected failure`,
      );
    } finally {
      this.running = false;
    }
  }

  /** Work items to process this run. */
  protected abstract collect(): Promise<T[]>;

  /** Process one item; resolve false (or throw) to record a failure. */
  protected abstract process(item: T): Promise<boolean>;

  /** Optional completion hook (e.g. chaining a follow-up job). */
  protected onDone?(_processed: number, _failed: number): void | Promise<void>;
}
