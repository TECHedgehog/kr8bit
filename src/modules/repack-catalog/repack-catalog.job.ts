import { logger } from '../../logger/index.js';
import { config } from '../../config/index.js';
type RepackSettingsState = Pick<Awaited<ReturnType<RepackCatalogJobService['settings']>>, 'enabled' | 'baseUrl'>;

export interface RepackCatalogJobService {
  settings(): Promise<{ enabled: boolean; baseUrl: string; intervalHours: number; auditEnabled: boolean; auditIntervalHours: number }>;
  cancel(): void;
  isRunning(): boolean;
  sync(fullArchive?: boolean): Promise<unknown>;
  audit(): Promise<unknown>;
}

export class RepackCatalogJob {
  private syncHandle: NodeJS.Timeout | null = null;
  private auditHandle: NodeJS.Timeout | null = null;
  private generation = 0;

  constructor(private readonly service: RepackCatalogJobService) {}

  async start(runImmediately = true): Promise<void> {
    const generation = ++this.generation;
    this.clearTimers();
    const settings = await this.service.settings();
    if (generation !== this.generation || !settings.enabled) return;

    if (runImmediately) this.runSync();
    this.syncHandle = setInterval(() => this.runSync(), settings.intervalHours * 3_600_000);
    if (settings.auditEnabled) {
      this.auditHandle = setInterval(() => this.runAudit(), settings.auditIntervalHours * 3_600_000);
    }
  }

  async onSettingsChanged(before: RepackSettingsState, after: RepackSettingsState): Promise<void> {
    if (config.demoMode) return;
    if (!after.enabled) {
      this.stop();
      return;
    }
    const shouldSync = (!before.enabled && after.enabled) || before.baseUrl !== after.baseUrl;
    await this.start(shouldSync);
  }

  stop(): void {
    this.generation += 1;
    this.clearTimers();
    this.service.cancel();
  }

  isRunning(): boolean { return this.service.isRunning(); }
  sync(fullArchive = false) { return this.service.sync(fullArchive); }
  audit() { return this.service.audit(); }

  private clearTimers(): void {
    if (this.syncHandle) clearInterval(this.syncHandle);
    if (this.auditHandle) clearInterval(this.auditHandle);
    this.syncHandle = null;
    this.auditHandle = null;
  }

  private runSync(): void {
    void this.service.sync().catch((error) => logger.warn({ error }, 'scheduled repack sync failed'));
  }

  private runAudit(): void {
    void this.service.audit().catch((error) => logger.warn({ error }, 'scheduled repack audit failed'));
  }
}
