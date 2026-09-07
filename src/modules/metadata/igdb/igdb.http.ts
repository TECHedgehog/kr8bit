import { config } from '../../../config/index.js';
import type { IgdbGame, IgdbTokenResponse } from './igdb.http.types.js';
import {
  requestJson,
  withRetry,
  HttpError,
} from '../../../shared/http-client.js';

export interface IgdbCredentials {
  clientId: string;
  clientSecret: string;
}

export interface IgdbTokenProvider {
  getAccessToken(): Promise<string>;
  invalidate(): void;
}

export interface IgdbHttpClient {
  searchGames(query: string): Promise<IgdbGame[]>;
  getGame(id: number): Promise<IgdbGame | null>;
}

const SEARCH_FIELDS = [
  'name',
  'alternative_names.name',
  'first_release_date',
  'cover.url',
  'artworks.url',
].join(',');

const GAME_FIELDS = [
  'name',
  'summary',
  'first_release_date',
  'genres.name',
  'themes.name',
  'involved_companies.company.name',
  'involved_companies.developer',
  'involved_companies.publisher',
  'cover.url',
  'artworks.url',
  'screenshots.url',
].join(',');

const SEARCH_LIMIT = 20;
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export class IgdbTokenManager implements IgdbTokenProvider {
  private cached: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly credentials: IgdbCredentials,
    private readonly tokenBase: string,
    private readonly timeoutMs: number,
  ) {}

  invalidate(): void {
    this.cached = null;
  }

  async getAccessToken(): Promise<string> {
    if (this.cached && Date.now() < this.cached.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return this.cached.token;
    }
    // client_secret travels in the URL query; the shared client strips
    // queries from logs and error messages.
    const { clientId, clientSecret } = this.credentials;
    const url = `${this.tokenBase}/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
    const body = await requestJson<IgdbTokenResponse>(url, {
      label: 'igdb token',
      method: 'POST',
      headersTimeoutMs: this.timeoutMs,
      bodyTimeoutMs: this.timeoutMs,
    });
    this.cached = {
      token: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };
    return this.cached.token;
  }
}

export class IgdbHttpClientImpl implements IgdbHttpClient {
  constructor(
    private readonly credentials: IgdbCredentials,
    private readonly token: IgdbTokenProvider,
    private readonly apiBase: string,
    private readonly timeoutMs: number,
  ) {}

  async searchGames(query: string): Promise<IgdbGame[]> {
    const body = `search "${escapeIgdbQuery(query)}"; fields ${SEARCH_FIELDS}; limit ${SEARCH_LIMIT};`;
    return this.postGames(body);
  }

  async getGame(id: number): Promise<IgdbGame | null> {
    const body = `fields ${GAME_FIELDS}; where id = ${id};`;
    const rows = await this.postGames(body);
    return rows[0] ?? null;
  }

  private async postGames(queryBody: string): Promise<IgdbGame[]> {
    return withRetry(
      () => this.makeRequestWithTokenRefresh(queryBody),
      { retries: config.httpRetry.count, baseDelayMs: config.httpRetry.baseDelayMs },
    );
  }

  private async makeRequestWithTokenRefresh(queryBody: string): Promise<IgdbGame[]> {
    try {
      return await this.makeGamesRequest(queryBody);
    } catch (err) {
      // Typed 401 detection: expired tokens are refreshed once per attempt.
      if (err instanceof HttpError && err.statusCode === 401) {
        this.token.invalidate();
        return this.makeGamesRequest(queryBody);
      }
      throw err;
    }
  }

  private async makeGamesRequest(queryBody: string): Promise<IgdbGame[]> {
    const token = await this.token.getAccessToken();
    return requestJson<IgdbGame[]>(`${this.apiBase}/games`, {
      label: 'igdb',
      method: 'POST',
      headers: {
        'Client-ID': this.credentials.clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: queryBody,
      headersTimeoutMs: this.timeoutMs,
      bodyTimeoutMs: this.timeoutMs,
    });
  }
}

export function escapeIgdbQuery(query: string): string {
  return query
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

export function createIgdbHttpClient(
  credentials: IgdbCredentials,
  tokenProvider: IgdbTokenProvider,
  apiBase: string,
  timeoutMs: number,
): IgdbHttpClient {
  return new IgdbHttpClientImpl(credentials, tokenProvider, apiBase, timeoutMs);
}

export const igdbHttpClient: IgdbHttpClient | null = config.igdb.enabled
  ? createIgdbHttpClient(
      {
        clientId: config.igdb.clientId as string,
        clientSecret: config.igdb.clientSecret as string,
      },
      new IgdbTokenManager(
        {
          clientId: config.igdb.clientId as string,
          clientSecret: config.igdb.clientSecret as string,
        },
        config.igdb.tokenBase,
        config.igdb.httpTimeoutMs,
      ),
      config.igdb.apiBase,
      config.igdb.httpTimeoutMs,
    )
  : null;
