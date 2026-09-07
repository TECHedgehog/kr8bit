import { config } from '../../../config/index.js';
import type {
  SteamGridDbImage,
  SteamGridDbImageQuery,
  SteamGridDbImageResponse,
} from './steamgriddb.http.types.js';
import { requestJson } from '../../../shared/http-client.js';

export interface SteamGridDbHttpClient {
  getGridsBySteamAppId(steamAppId: number, query?: SteamGridDbImageQuery): Promise<SteamGridDbImage[]>;
  getHeroesBySteamAppId(steamAppId: number, query?: SteamGridDbImageQuery): Promise<SteamGridDbImage[]>;
  getLogosBySteamAppId(steamAppId: number, query?: SteamGridDbImageQuery): Promise<SteamGridDbImage[]>;
}

export class SteamGridDbHttpClientImpl implements SteamGridDbHttpClient {
  constructor(
    private readonly apiKey: string,
    private readonly apiBase: string,
    private readonly timeoutMs: number,
  ) {}

  async getGridsBySteamAppId(steamAppId: number, query?: SteamGridDbImageQuery): Promise<SteamGridDbImage[]> {
    return this.fetchImages(`/grids/steam/${steamAppId}`, query);
  }

  async getHeroesBySteamAppId(steamAppId: number, query?: SteamGridDbImageQuery): Promise<SteamGridDbImage[]> {
    return this.fetchImages(`/heroes/steam/${steamAppId}`, query);
  }

  async getLogosBySteamAppId(steamAppId: number, query?: SteamGridDbImageQuery): Promise<SteamGridDbImage[]> {
    return this.fetchImages(`/logos/steam/${steamAppId}`, query);
  }

  private async fetchImages(path: string, query?: SteamGridDbImageQuery): Promise<SteamGridDbImage[]> {
    const url = new URL(`${this.apiBase}${path}`);
    if (query) {
      if (query.styles?.length) url.searchParams.set('styles', query.styles.join(','));
      if (query.dimensions?.length) url.searchParams.set('dimensions', query.dimensions.join(','));
      if (query.mimes?.length) url.searchParams.set('mimes', query.mimes.join(','));
      if (query.types?.length) url.searchParams.set('types', query.types.join(','));
      if (query.nsfw !== undefined) url.searchParams.set('nsfw', query.nsfw);
      if (query.humor !== undefined) url.searchParams.set('humor', query.humor);
      if (query.epilepsy !== undefined) url.searchParams.set('epilepsy', query.epilepsy);
      if (query.oneoftag !== undefined) url.searchParams.set('oneoftag', query.oneoftag);
      if (query.page !== undefined) url.searchParams.set('page', String(query.page));
    }

    try {
      const body = await requestJson<SteamGridDbImageResponse>(url.toString(), {
        label: 'steamgriddb',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        headersTimeoutMs: this.timeoutMs,
        bodyTimeoutMs: this.timeoutMs,
      });
      if (!body.success) {
        return [];
      }
      return body.data;
    } catch {
      // Artwork enrichment is best-effort: upstream errors (including
      // non-2xx after retries, already logged by the shared client)
      // degrade to "no artwork", never fail a scan.
      return [];
    }
  }
}

export function createSteamGridDbHttpClient(
  apiKey: string,
  apiBase: string,
  timeoutMs: number,
): SteamGridDbHttpClient {
  return new SteamGridDbHttpClientImpl(apiKey, apiBase, timeoutMs);
}

export const steamGridDbHttpClient: SteamGridDbHttpClient | null = config.steamgriddb.enabled
  ? createSteamGridDbHttpClient(
      config.steamgriddb.apiKey as string,
      config.steamgriddb.apiBase,
      config.steamgriddb.httpTimeoutMs,
    )
  : null;
