import { config } from '../../../config/index.js';
import {
  STEAM_API_BASE,
  type SteamAppListResponse,
  type SteamAppListEntry,
} from '../steam/steam.http.types.js';
import { requestJson } from '../../../shared/http-client.js';

export interface SteamAppListClient {
  fetchAppList(): Promise<SteamAppListEntry[]>;
}

export const steamAppListClient: SteamAppListClient = {
  async fetchAppList(): Promise<SteamAppListEntry[]> {
    const key = config.steamIndex.apiKey;
    // The key travels in the URL query; the shared client strips queries
    // from every log line and error message, so the secret never leaks.
    const keyParam = key ? `?key=${encodeURIComponent(key)}` : '';
    const url = `${STEAM_API_BASE}/ISteamApps/GetAppList/v2${keyParam}`;
    const body = await requestJson<SteamAppListResponse>(url, {
      label: 'steam applist',
      headersTimeoutMs: config.steamIndex.appListHttpTimeoutMs,
      bodyTimeoutMs: config.steamIndex.appListHttpTimeoutMs,
    });
    return body.applist?.apps ?? [];
  },
};
