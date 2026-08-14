import { request } from 'undici';
import { logger } from '../../../logger/index.js';
import { config } from '../../../config/index.js';
import {
  STEAM_STORE_BASE,
  type SteamStoreSearchResponse,
  type SteamAppDetailsResponse,
} from './steam.http.types.js';
import {
  withRetry,
  RetryableHttpError,
  isRetryableStatus,
} from '../../../shared/http-retry.js';

export interface SteamHttpClient {
  searchStore(term: string): Promise<SteamStoreSearchResponse>;
  fetchAppDetails(appId: number): Promise<SteamAppDetailsResponse>;
}

async function getJson(url: string): Promise<unknown> {
  return withRetry(
    async () => {
      const res = await request(url, {
        method: 'GET',
        headersTimeout: config.steam.httpTimeoutMs,
        bodyTimeout: config.steam.httpTimeoutMs,
        headers: { 'Accept': 'application/json', 'User-Agent': 'kr8bit/0.1' },
      });
      if (isRetryableStatus(res.statusCode)) {
        throw new RetryableHttpError(`steam http ${res.statusCode} for ${url}`);
      }
      if (res.statusCode >= 400) {
        const text = await res.body.text();
        logger.warn({ url, statusCode: res.statusCode, text: text.slice(0, 200) }, 'steam http non-2xx');
        throw new Error(`steam http ${res.statusCode} for ${url}`);
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

export const steamHttpClient: SteamHttpClient = {
  async searchStore(term: string): Promise<SteamStoreSearchResponse> {
    const url = `${STEAM_STORE_BASE}/api/storesearch/?term=${encodeURIComponent(term)}&l=en&cc=us`;
    const body = await getJson(url);
    return body as SteamStoreSearchResponse;
  },

  async fetchAppDetails(appId: number): Promise<SteamAppDetailsResponse> {
    const url = `${STEAM_STORE_BASE}/api/appdetails?appids=${appId}&l=en`;
    const body = await getJson(url);
    return body as SteamAppDetailsResponse;
  },
};