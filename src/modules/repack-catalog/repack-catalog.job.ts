import { logger } from '../../logger/index.js';
import { repackCatalogService } from './repack-catalog.service.js';

export class RepackCatalogJob {
  private syncHandle: NodeJS.Timeout | null = null;
  private auditHandle: NodeJS.Timeout | null = null;
  private generation = 0;

  async start(runImmediately = true): Promise<void> {
    const generation = ++this.generation;
    this.clearTimers();
    const settings = await repackCatalogService.settings();
    if (generation !== this.generation || !settings.enabled) return;

    if (runImmediately) this.runSync();
    this.syncHandle = setInterval(() => this.runSync(), settings.intervalHours * 3_600_000);
    if (settings.auditEnabled) {
      this.auditHandle = setInterval(() => this.runAudit(), settings.auditIntervalHours * 3_600_000);
    }
  }

  stop(): void {
    this.generation += 1;
    this.clearTimers();
    repackCatalogService.cancel();
  }

  isRunning(): boolean { return repackCatalogService.isRunning(); }
  sync(fullArchive = false) { return repackCatalogService.sync(fullArchive); }
  audit() { return repackCatalogService.audit(); }

  private clearTimers(): void {
    if (this.syncHandle) clearInterval(this.syncHandle);
    if (this.auditHandle) clearInterval(this.auditHandle);
    this.syncHandle = null;
    this.auditHandle = null;
  }

  private runSync(): void {
    void repackCatalogService.sync().catch((error) => logger.warn({ error }, 'scheduled repack sync failed'));
  }

  private runAudit(): void {
    void repackCatalogService.audit().catch((error) => logger.warn({ error }, 'scheduled repack audit failed'));
  }
}

export const repackCatalogJob = new RepackCatalogJob();
