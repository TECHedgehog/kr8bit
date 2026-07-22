import Fuse from 'fuse.js';
import { logger } from '../../../logger/index.js';
import { config } from '../../../config/index.js';
import { settingsRepository } from '../../settings/settings.repository.js';
import { steamIndexRepository } from './steam-index.repository.js';
import { steamAppListClient as defaultAppListClient, type SteamAppListClient } from './steam-index.http.js';

const SETTING_LAST_REFRESH = 'steamIndexLastRefresh';
const FUSE_THRESHOLD = 0.5;
const FUSE_KEYS = ['name'];
const SEARCH_LIMIT = 20;
const REBUILD_WARN_ROW_THRESHOLD = 200_000;

export interface SteamIndexSearchResult {
  appId: number;
  name: string;
  score: number;
}

export interface SteamIndexRefreshResult {
  ok: boolean;
  reason?: 'in-progress' | 'no-change' | 'fetch-failed' | 'persist-failed';
  rows?: number;
  refreshedAt?: string;
}

export interface SteamIndexDeps {
  appListClient: SteamAppListClient;
  now: () => Date;
  enabled: boolean;
  refreshIntervalHours: number;
}

export const defaultSteamIndexDeps: SteamIndexDeps = {
  appListClient: defaultAppListClient,
  now: () => new Date(),
  enabled: config.steamIndex.enabled,
  refreshIntervalHours: config.steamIndex.refreshIntervalHours,
};

export interface SteamIndexSearcher {
  searchByName(query: string): Promise<SteamIndexSearchResult[]>;
}

export class SteamIndexService implements SteamIndexSearcher {
  private readonly deps: SteamIndexDeps;
  private fuse: Fuse<{ appId: number; name: string }> | null = null;
  private refreshing = false;
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(deps: SteamIndexDeps = defaultSteamIndexDeps) {
    this.deps = deps;
  }

  /**
   * Boot hook: if STEAM_API_KEY is set and index is stale, schedule refresh
   * in background (fire-and-forget). Then schedule periodic refresh.
   * Without a key, indexer stays disabled — SteamProvider.search falls back
   * to live storesearch. Non-blocking; never throws.
   */
  async start(): Promise<void> {
    if (!this.deps.enabled) {
      logger.info('steam index disabled (no STEAM_API_KEY) — search will use live storesearch');
      return;
    }
    const stale = await this.isStale();
    if (stale) {
      this.refresh().catch((err) => {
        logger.error({ err: (err as Error).message }, 'steam index boot refresh failed');
      });
    }
    const intervalMs = this.deps.refreshIntervalHours * 60 * 60 * 1000;
    this.intervalHandle = setInterval(() => {
      this.refresh().catch((err) => {
        logger.error({ err: (err as Error).message }, 'steam index scheduled refresh failed');
      });
    }, intervalMs);
    logger.info(
      { refreshIntervalHours: this.deps.refreshIntervalHours, staleAtBoot: stale },
      'steam index service started',
    );
  }

  /**
   * Shutdown: clear scheduled refresh. Safe to call multiple times.
   */
  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  isRefreshing(): boolean {
    return this.refreshing;
  }

  async searchByName(query: string): Promise<SteamIndexSearchResult[]> {
    if (!this.fuse) return [];
    const normalized = query.trim();
    if (!normalized) return [];
    const matches = this.fuse.search(normalized, { limit: SEARCH_LIMIT });
    return matches
      .filter((m) => m.score !== undefined && m.score <= FUSE_THRESHOLD)
      .map((m) => ({
        appId: m.item.appId,
        name: m.item.name,
        score: m.score as number,
      }));
  }

  async refresh(): Promise<SteamIndexRefreshResult> {
    if (this.refreshing) {
      return { ok: false, reason: 'in-progress' };
    }
    this.refreshing = true;
    try {
      const entries = await this.deps.appListClient.fetchAppList();
      const inserted = await steamIndexRepository.replaceAll(entries);
      await this.rebuildFuse();
      const refreshedAt = this.deps.now().toISOString();
      await settingsRepository.set(SETTING_LAST_REFRESH, refreshedAt);
      logger.info({ rows: inserted, refreshedAt }, 'steam index refreshed');
      return { ok: true, rows: inserted, refreshedAt };
    } catch (err) {
      const message = (err as Error).message;
      const reason = message.includes('persist')
        ? 'persist-failed'
        : 'fetch-failed';
      logger.error({ err: message, reason }, 'steam index refresh failed');
      return { ok: false, reason };
    } finally {
      this.refreshing = false;
    }
  }

  private async isStale(): Promise<boolean> {
    const last = await settingsRepository.get(SETTING_LAST_REFRESH);
    if (!last) return true;
    const lastMs = Date.parse(last);
    if (Number.isNaN(lastMs)) return true;
    const intervalMs = this.deps.refreshIntervalHours * 60 * 60 * 1000;
    return Date.now() - lastMs >= intervalMs;
  }

  private async rebuildFuse(): Promise<void> {
    const rows = await steamIndexRepository.findAll();
    if (rows.length > REBUILD_WARN_ROW_THRESHOLD) {
      logger.warn({ rows: rows.length }, 'steam app index large; rebuilding fuse in-memory');
    }
    this.fuse = new Fuse(rows, {
      keys: FUSE_KEYS,
      includeScore: true,
      threshold: FUSE_THRESHOLD,
      ignoreLocation: true,
      isCaseSensitive: false,
    });
    logger.info({ rows: rows.length }, 'steam index fuse rebuilt');
  }
}

export const steamIndexService = new SteamIndexService();