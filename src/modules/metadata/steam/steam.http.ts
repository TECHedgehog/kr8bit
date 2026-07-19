import { request } from 'undici';
import { logger } from '../../../logger/index.js';
import {
  STEAM_STORE_BASE,
  STEAM_HTTP_TIMEOUT_MS,
  type SteamStoreSearchResponse,
  type SteamAppDetailsResponse,
} from './steam.http.types.js';

export interface SteamHttpClient {
  searchStore(term: string): Promise<SteamStoreSearchResponse>;
  fetchAppDetails(appId: number): Promise<SteamAppDetailsResponse>;
}

async function getJson(url: string): Promise<unknown> {
  const res = await request(url, {
    method: 'GET',
    headersTimeout: STEAM_HTTP_TIMEOUT_MS,
    bodyTimeout: STEAM_HTTP_TIMEOUT_MS,
    headers: { 'Accept': 'application/json', 'User-Agent': 'kr8bit/0.1' },
  });
  if (res.statusCode >= 400) {
    const text = await res.body.text();
    logger.warn({ url, statusCode: res.statusCode, text: text.slice(0, 200) }, 'steam http non-2xx');
    throw new Error(`steam http ${res.statusCode} for ${url}`);
  }
  return res.body.json();
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