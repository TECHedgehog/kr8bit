import { request } from 'undici';
import { logger } from '../../../logger/index.js';
import { config } from '../../../config/index.js';
import type { IgdbGame, IgdbTokenResponse } from './igdb.http.types.js';

export interface IgdbCredentials {
  clientId: string;
  clientSecret: string;
}

export interface IgdbTokenProvider {
  getAccessToken(): Promise<string>;
}

export interface IgdbHttpClient {
  searchGames(query: string): Promise<IgdbGame[]>;
  getGame(id: number): Promise<IgdbGame | null>;
}

const SEARCH_FIELDS = [
  'name',
  'first_release_date',
  'cover.url',
  'artworks.url',
].join(',');

const GAME_FIELDS = [
  'name',
  'summary',
  'first_release_date',
  'genres.name',
  'involved_companies.company.name',
  'involved_companies.developer',
  'involved_companies.publisher',
  'cover.url',
  'artworks.url',
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

  async getAccessToken(): Promise<string> {
    if (this.cached && Date.now() < this.cached.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return this.cached.token;
    }
    const { clientId, clientSecret } = this.credentials;
    const url = `${this.tokenBase}/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
    const res = await request(url, {
      method: 'POST',
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
      headers: { 'Accept': 'application/json', 'User-Agent': 'kr8bit/0.1' },
    });
    if (res.statusCode >= 400) {
      const text = await res.body.text();
      logger.warn(
        { statusCode: res.statusCode, text: text.slice(0, 200) },
        'igdb token request failed',
      );
      throw new Error(`igdb token http ${res.statusCode}`);
    }
    const body = (await res.body.json()) as IgdbTokenResponse;
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
    const token = await this.token.getAccessToken();
    const res = await request(`${this.apiBase}/games`, {
      method: 'POST',
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
      headers: {
        'Accept': 'application/json',
        'Client-ID': this.credentials.clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
        'User-Agent': 'kr8bit/0.1',
      },
      body: queryBody,
    });
    if (res.statusCode >= 400) {
      const text = await res.body.text();
      logger.warn(
        { statusCode: res.statusCode, text: text.slice(0, 200), queryBody },
        'igdb games request failed',
      );
      throw new Error(`igdb http ${res.statusCode}`);
    }
    return (await res.body.json()) as IgdbGame[];
  }
}

function escapeIgdbQuery(query: string): string {
  return query.replace(/"/g, '\\"');
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