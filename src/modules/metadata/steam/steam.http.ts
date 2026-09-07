import { config } from '../../../config/index.js';
import {
  STEAM_STORE_BASE,
  type SteamStoreSearchResponse,
  type SteamAppDetailsResponse,
  type SteamDeckCompatibility,
} from './steam.http.types.js';
import {
  requestJson,
  requestText,
  withRetry,
  RetryableHttpError,
} from '../../../shared/http-client.js';

export interface SteamHttpClient {
  searchStore(term: string): Promise<SteamStoreSearchResponse>;
  fetchAppDetails(appId: number): Promise<SteamAppDetailsResponse>;
  fetchDeckCompatibility(appId: number): Promise<SteamDeckCompatibility | null>;
}

function steamOptions() {
  return {
    label: 'steam',
    headersTimeoutMs: config.steam.httpTimeoutMs,
    bodyTimeoutMs: config.steam.httpTimeoutMs,
  };
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
    return requestJson<SteamStoreSearchResponse>(url, steamOptions());
  },

  async fetchAppDetails(appId: number): Promise<SteamAppDetailsResponse> {
    const url = `${STEAM_STORE_BASE}/api/appdetails?appids=${appId}&l=en`;
    let lastBody: unknown;
    try {
      // Single retry layer: transport errors AND Steam's transient
      // success:false responses share one small retry budget (bad appIds
      // fail fast, transient hiccups usually resolve on the first retry).
      return await withRetry(
        async () => {
          const body = await requestJson<SteamAppDetailsResponse>(url, {
            ...steamOptions(),
            label: 'steam appdetails',
            retries: 0,
          });
          lastBody = body;
          const entry = body[String(appId)];
          if (!entry?.success) {
            throw new RetryableHttpError(`steam appdetails success:false for ${appId}`);
          }
          return body;
        },
        {
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
    const html = await requestText(url, steamOptions());
    const match = html.match(/data-hardwarecompatibility="([^"]*)"/);
    if (!match) return null;
    const decoded = decodeHtmlEntities(match[1]);
    return parseDeckCompatibility(decoded);
  },
};
