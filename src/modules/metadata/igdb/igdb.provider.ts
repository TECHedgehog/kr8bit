import Fuse from 'fuse.js';
import { logger } from '../../../logger/index.js';
import type {
  GameMetadata,
  MetadataProvider,
  SearchResult,
} from '../../../shared/types.js';
import type { IgdbGame } from './igdb.http.types.js';
import {
  IGDB_IMAGE_SIZE_COVER,
  IGDB_IMAGE_SIZE_HEADER,
  normalizeIgdbImageUrl,
} from './igdb.http.types.js';
import { igdbHttpClient as defaultClient } from './igdb.http.js';
import type { IgdbHttpClient } from './igdb.http.js';

const SEARCH_LIMIT = 20;
const FUSE_THRESHOLD = 0.6;

export class IgdbProvider implements MetadataProvider {
  readonly name = 'igdb';

  constructor(private readonly client: IgdbHttpClient = defaultClient as IgdbHttpClient) {}

  async search(query: string): Promise<SearchResult[]> {
    const normalized = query.trim();
    if (!normalized) return [];

    let response: IgdbGame[];
    try {
      response = await this.client.searchGames(normalized);
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, query: normalized },
        'igdb search failed',
      );
      return [];
    }

    if (!response || response.length === 0) return [];

    const fuse = new Fuse(response, {
      keys: ['name'],
      threshold: FUSE_THRESHOLD,
      includeScore: true,
      ignoreLocation: true,
      isCaseSensitive: false,
    });

    return fuse
      .search(normalized, { limit: SEARCH_LIMIT })
      .map(({ item, score }) => this.buildResult(item, score));
  }

  async getGame(remoteId: string): Promise<GameMetadata | null> {
    const id = Number(remoteId);
    if (!Number.isInteger(id) || id <= 0) return null;

    try {
      const game = await this.client.getGame(id);
      if (!game) {
        logger.info({ igdbId: id }, 'igdb game not found');
        return null;
      }
      return this.mapGame(game);
    } catch (err) {
      logger.warn(
        { igdbId: id, err: (err as Error).message },
        'igdb getGame failed',
      );
      return null;
    }
  }

  private buildResult(item: IgdbGame, score: number | undefined): SearchResult {
    return {
      providerName: this.name,
      remoteId: String(item.id),
      title: item.name,
      releaseYear: this.extractYear(item.first_release_date),
      coverUrl: normalizeIgdbImageUrl(item.cover?.url, IGDB_IMAGE_SIZE_COVER),
      score: score !== undefined ? Math.round((1 - score) * 100) : undefined,
    };
  }

  private mapGame(game: IgdbGame): GameMetadata {
    const developers: string[] = [];
    const publishers: string[] = [];
    for (const ic of game.involved_companies ?? []) {
      if (!ic?.company?.name) continue;
      if (ic.developer) developers.push(ic.company.name);
      if (ic.publisher) publishers.push(ic.company.name);
    }

    const firstArtwork = game.artworks?.[0]?.url;

    return {
      remoteId: String(game.id),
      title: game.name,
      releaseYear: this.extractYear(game.first_release_date),
      description: game.summary ?? undefined,
      developers,
      publishers,
      genres: (game.genres ?? []).map((g) => g.name),
      coverUrl: normalizeIgdbImageUrl(game.cover?.url, IGDB_IMAGE_SIZE_COVER),
      headerUrl: normalizeIgdbImageUrl(firstArtwork, IGDB_IMAGE_SIZE_HEADER),
    };
  }

  private extractYear(unixSeconds: number | undefined): number | undefined {
    if (!unixSeconds || unixSeconds <= 0) return undefined;
    const year = new Date(unixSeconds * 1000).getUTCFullYear();
    if (year < 1970 || year > 2100) return undefined;
    return year;
  }
}

export const igdbProvider: IgdbProvider | null =
  defaultClient === null ? null : new IgdbProvider(defaultClient);