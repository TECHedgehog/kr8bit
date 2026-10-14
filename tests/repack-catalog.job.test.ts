import { afterEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => vi.fn());
const sync = vi.hoisted(() => vi.fn());
const audit = vi.hoisted(() => vi.fn());
const isRunning = vi.hoisted(() => vi.fn());
const cancel = vi.hoisted(() => vi.fn());

vi.mock('../src/modules/repack-catalog/repack-catalog.service.js', () => ({
  repackCatalogService: { settings, sync, audit, isRunning, cancel },
}));
import { RepackCatalogJob } from '../src/modules/repack-catalog/repack-catalog.job.js';

describe('RepackCatalogJob', () => {
  afterEach(() => vi.useRealTimers());

  it('replaces old timers on reconfiguration and runs no full import', async () => {
    vi.useFakeTimers();
    settings.mockResolvedValue({ enabled: true, intervalHours: 24, auditEnabled: true, auditIntervalHours: 720 });
    sync.mockResolvedValue({});
    audit.mockResolvedValue({});
    const job = new RepackCatalogJob();

    await job.start(false);
    await job.start(false);
    expect(vi.getTimerCount()).toBe(2);
    expect(sync).not.toHaveBeenCalled();
    job.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('keeps source disabled without scheduling', async () => {
    vi.useFakeTimers();
    settings.mockResolvedValue({ enabled: false, intervalHours: 24, auditEnabled: false, auditIntervalHours: 720 });
    const job = new RepackCatalogJob();
    await job.start();
    expect(vi.getTimerCount()).toBe(0);
  });
});
