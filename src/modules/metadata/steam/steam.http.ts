import { request } from 'undici';
import { logger } from '../../../logger/index.js';
import { config } from '../../../config/index.js';
import {
  STEAM_STORE_BASE,
  type SteamStoreSearchResponse,
  type SteamAppDetailsResponse,
  type SteamDeckCompatibility,
} from './steam.http.types.js';
import {
  withRetry,
  RetryableHttpError,
  isRetryableStatus,
} from '../../../shared/http-retry.js';

export interface SteamHttpClient {
  searchStore(term: string): Promise<SteamStoreSearchResponse>;
  fetchAppDetails(appId: number): Promise<SteamAppDetailsResponse>;
  fetchDeckCompatibility(appId: number): Promise<SteamDeckCompatibility | null>;
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

async function getText(url: string): Promise<string> {
  return withRetry(
    async () => {
      const res = await request(url, {
        method: 'GET',
        headersTimeout: config.steam.httpTimeoutMs,
        bodyTimeout: config.steam.httpTimeoutMs,
        headers: { 'Accept': 'text/html', 'User-Agent': 'kr8bit/0.1' },
      });
      if (isRetryableStatus(res.statusCode)) {
        throw new RetryableHttpError(`steam http ${res.statusCode} for ${url}`);
      }
      if (res.statusCode >= 400) {
        const text = await res.body.text();
        logger.warn({ url, statusCode: res.statusCode, text: text.slice(0, 200) }, 'steam http non-2xx');
        throw new Error(`steam http ${res.statusCode} for ${url}`);
      }
      return res.body.text();
    },
    {
      retries: config.httpRetry.count,
      baseDelayMs: config.httpRetry.baseDelayMs,
      retryOn: (err) => err instanceof RetryableHttpError,
    },
  );
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function isSteamDeckCompatibilityItem(value: unknown): value is { display_type: number; loc_token: string } {
  if (value === null || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.display_type === 'number' && typeof item.loc_token === 'string';
}

function parseDeckCompatibility(jsonText: string): SteamDeckCompatibility | null {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (parsed === null || typeof parsed !== 'object') return null;
    const data = parsed as Record<string, unknown>;
    if (typeof data.resolved_category !== 'number' || !Array.isArray(data.resolved_items)) return null;
    const items = data.resolved_items.filter(isSteamDeckCompatibilityItem);
    return { appid: Number(data.appid), resolved_category: data.resolved_category, resolved_items: items };
  } catch {
    return null;
  }
}

export const steamHttpClient: SteamHttpClient = {
  async searchStore(term: string): Promise<SteamStoreSearchResponse> {
    const url = `${STEAM_STORE_BASE}/api/storesearch/?term=${encodeURIComponent(term)}&l=en&cc=us`;
    const body = await getJson(url);
    return body as SteamStoreSearchResponse;
  },

  async fetchAppDetails(appId: number): Promise<SteamAppDetailsResponse> {
    const url = `${STEAM_STORE_BASE}/api/appdetails?appids=${appId}&l=en`;
    let lastBody: unknown;
    try {
      return await withRetry(
        async () => {
          const body = await getJson(url);
          lastBody = body;
          const response = body as SteamAppDetailsResponse;
          const entry = response[String(appId)];
          if (!entry?.success) {
            throw new RetryableHttpError(`steam appdetails success:false for ${appId}`);
          }
          return response;
        },
        {
          // Steam appdetails returns success:false transiently (rate limits,
          // cache misses). Keep this small: bad appIds fail fast, transient
          // hiccups usually resolve on the first retry.
          retries: 2,
          baseDelayMs: 500,
        },
      );
    } catch (err) {
      if (lastBody !== undefined) {
        return lastBody as SteamAppDetailsResponse;
      }
      throw err;
    }
  },

  async fetchDeckCompatibility(appId: number): Promise<SteamDeckCompatibility | null> {
    const url = `${STEAM_STORE_BASE}/app/${appId}/?l=en`;
    const html = await getText(url);
    const match = html.match(/data-hardwarecompatibility="([^"]*)"/);
    if (!match) return null;
    const decoded = decodeHtmlEntities(match[1]);
    return parseDeckCompatibility(decoded);
  },
};