import { request } from 'undici';
import { logger } from '../../../logger/index.js';
import { config } from '../../../config/index.js';
import type {
  SteamGridDbImage,
  SteamGridDbImageQuery,
  SteamGridDbImageResponse,
} from './steamgriddb.http.types.js';
import {
  withRetry,
  RetryableHttpError,
  isRetryableStatus,
} from '../../../shared/http-retry.js';

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
      return await withRetry(
        async () => {
          const res = await request(url.toString(), {
            method: 'GET',
            headersTimeout: this.timeoutMs,
            bodyTimeout: this.timeoutMs,
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Accept': 'application/json',
              'User-Agent': 'kr8bit/0.1',
            },
          });
          if (isRetryableStatus(res.statusCode)) {
            throw new RetryableHttpError(`steamgriddb http ${res.statusCode} for ${path}`);
          }
          if (res.statusCode >= 400) {
            const text = await res.body.text();
            logger.warn(
              { statusCode: res.statusCode, text: text.slice(0, 200), path },
              'steamgriddb images request failed',
            );
            return [];
          }
          const body = (await res.body.json()) as SteamGridDbImageResponse;
          if (!body.success) {
            logger.warn({ path, errors: body.errors }, 'steamgriddb images request unsuccessful');
            return [];
          }
          return body.data;
        },
        {
          retries: config.httpRetry.count,
          baseDelayMs: config.httpRetry.baseDelayMs,
          retryOn: (err) => err instanceof RetryableHttpError,
        },
      );
    } catch {
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
