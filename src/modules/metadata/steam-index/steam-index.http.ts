import { request } from 'undici';
import { logger } from '../../../logger/index.js';
import { config } from '../../../config/index.js';
import {
  STEAM_API_BASE,
  type SteamAppListResponse,
  type SteamAppListEntry,
} from '../steam/steam.http.types.js';
import {
  withRetry,
  RetryableHttpError,
  isRetryableStatus,
} from '../../../shared/http-retry.js';

export interface SteamAppListClient {
  fetchAppList(): Promise<SteamAppListEntry[]>;
}

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  return withRetry(
    async () => {
      const res = await request(url, {
        method: 'GET',
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
        headers: { 'Accept': 'application/json', 'User-Agent': 'kr8bit/0.1' },
      });
      if (isRetryableStatus(res.statusCode)) {
        throw new RetryableHttpError(`steam applist http ${res.statusCode} for ${url}`);
      }
      if (res.statusCode >= 400) {
        const text = await res.body.text();
        logger.warn({ url, statusCode: res.statusCode, text: text.slice(0, 200) }, 'steam applist http non-2xx');
        throw new Error(`steam applist http ${res.statusCode} for ${url}`);
      }
      return res.body.json();
    },
    {
      retries: config.httpRetry.count,
      baseDelayMs: config.httpRetry.baseDelayMs,
      retryOn: (err) => err instanceof RetryableHttpError,
    },
  );
}

export const steamAppListClient: SteamAppListClient = {
  async fetchAppList(): Promise<SteamAppListEntry[]> {
    const key = config.steamIndex.apiKey;
    const keyParam = key ? `?key=${encodeURIComponent(key)}` : '';
    const url = `${STEAM_API_BASE}/ISteamApps/GetAppList/v2${keyParam}`;
    const timeoutMs = config.steamIndex.appListHttpTimeoutMs;
    const body = await getJson(url, timeoutMs);
    const parsed = body as SteamAppListResponse;
    return parsed.applist?.apps ?? [];
  },
};
