import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { SteamIndexService } from '../src/modules/metadata/steam-index/steam-index.service.js';
import type { SteamAppListClient } from '../src/modules/metadata/steam-index/steam-index.http.js';
import { settingsRepository } from '../src/modules/settings/settings.repository.js';
import type { SteamAppListEntry } from '../src/modules/metadata/steam/steam.http.types.js';

const SETTING_LAST_REFRESH = 'steamIndexLastRefresh';

function mockAppListClient(entries: SteamAppListEntry[]): SteamAppListClient {
  return {
    fetchAppList: vi.fn(async () => entries),
  };
}

function failingAppListClient(): SteamAppListClient {
  return {
    fetchAppList: vi.fn(async () => {
      throw new Error('network down');
    }),
  };
}

beforeEach(async () => {
  await prisma.steamAppIndex.deleteMany({});
  await prisma.setting.deleteMany({ where: { key: SETTING_LAST_REFRESH } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('SteamIndexService.refresh', () => {
  it('fetches, persists, builds fuse, records setting', async () => {
    const entries = [
      { appid: 730, name: 'Counter-Strike 2' },
      { appid: 620, name: 'Portal 2' },
    ];
    const now = new Date('2026-01-15T10:00:00Z');
    const service = new SteamIndexService({
      appListClient: mockAppListClient(entries),
      now: () => now,
    });

    const result = await service.refresh();
    expect(result.ok).toBe(true);
    expect(result.rows).toBe(2);
    expect(result.refreshedAt).toBe(now.toISOString());

    const stored = await settingsRepository.get(SETTING_LAST_REFRESH);
    expect(stored).toBe(now.toISOString());

    expect(await prisma.steamAppIndex.count()).toBe(2);
  });

  it('returns in-progress when already refreshing', async () => {
    let releaseFetch: () => void = () => {};
    const fetchPromise = new Promise<SteamAppListEntry[]>((resolve) => {
      releaseFetch = () => resolve([{ appid: 1, name: 'Game' }]);
    });
    const client: SteamAppListClient = {
      fetchAppList: vi.fn(() => fetchPromise),
    };
    const service = new SteamIndexService({
      appListClient: client,
      now: () => new Date(),
    });

    const firstCall = service.refresh();
    const second = await service.refresh();
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('in-progress');

    releaseFetch();
    await firstCall;
  });

  it('reports fetch-failed when client throws', async () => {
    const service = new SteamIndexService({
      appListClient: failingAppListClient(),
      now: () => new Date(),
    });
    const result = await service.refresh();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('fetch-failed');
  });

  it('isRefreshing flag is reset after failure', async () => {
    const service = new SteamIndexService({
      appListClient: failingAppListClient(),
      now: () => new Date(),
    });
    await service.refresh();
    expect(service.isRefreshing()).toBe(false);
  });
});

describe('SteamIndexService.searchByName', () => {
  it('returns empty when fuse not built', async () => {
    const service = new SteamIndexService({
      appListClient: mockAppListClient([]),
      now: () => new Date(),
    });
    expect(await service.searchByName('Skyrim')).toEqual([]);
  });

  it('returns matches with raw fuse score (lower=better)', async () => {
    const entries = [
      { appid: 489830, name: 'The Elder Scrolls V: Skyrim Special Edition' },
      { appid: 72850, name: 'The Elder Scrolls V: Skyrim' },
      { appid: 1746860, name: 'The Elder Scrolls V: Skyrim Anniversary Upgrade' },
      { appid: 70, name: 'Half-Life' },
    ];
    const service = new SteamIndexService({
      appListClient: mockAppListClient(entries),
      now: () => new Date(),
    });
    await service.refresh();

    const results = await service.searchByName('Skyrim');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
      expect(r.appId).toBeGreaterThan(0);
      expect(r.name).toContain('Skyrim');
    }
  });

  it('filters below threshold (raw 0.5)', async () => {
    const entries = [
      { appid: 730, name: 'Counter-Strike 2' },
      { appid: 620, name: 'Portal 2' },
    ];
    const service = new SteamIndexService({
      appListClient: mockAppListClient(entries),
      now: () => new Date(),
    });
    await service.refresh();
    const results = await service.searchByName('xyzzy-no-such-game');
    expect(results).toEqual([]);
  });

  it('handles empty query', async () => {
    const service = new SteamIndexService({
      appListClient: mockAppListClient([{ appid: 1, name: 'Whatever' }]),
      now: () => new Date(),
    });
    await service.refresh();
    expect(await service.searchByName('')).toEqual([]);
    expect(await service.searchByName('   ')).toEqual([]);
  });
});

describe('SteamIndexService.start / stop', () => {
  it('kicks off boot refresh when stale and registers interval handle', async () => {
    const entries = [{ appid: 1, name: 'Boot Game' }];
    const service = new SteamIndexService({
      appListClient: mockAppListClient(entries),
      now: () => new Date(),
    });
    await service.start();
    // Drain microtask queue until boot refresh (fire-and-forget) lands.
    for (let i = 0; i < 20 && (await prisma.steamAppIndex.count()) === 0; i += 1) {
      await new Promise((r) => setImmediate(r));
    }
    expect(await prisma.steamAppIndex.count()).toBe(1);
    service.stop();
  });

  it('stop is idempotent', async () => {
    const service = new SteamIndexService({
      appListClient: mockAppListClient([]),
      now: () => new Date(),
    });
    service.stop();
    service.stop();
  });
});