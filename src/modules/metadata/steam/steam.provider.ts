import Fuse from 'fuse.js';
import { logger } from '../../../logger/index.js';
import type {
  GameMetadata,
  MetadataProvider,
  SearchResult,
} from '../../../shared/types.js';
import { STEAM_CDN_BASE } from './steam.http.types.js';
import type { SteamHttpClient } from './steam.http.js';
import { steamHttpClient as defaultClient } from './steam.http.js';
import type { SteamAppDetailsData, SteamStoreSearchItem } from './steam.http.types.js';
import type { SteamIndexSearcher, SteamIndexSearchResult } from '../steam-index/steam-index.service.js';
import { steamIndexService } from '../steam-index/steam-index.service.js';
import { normalizeGenres } from '../genre-map.js';
import { normalizeForMatch } from '../../../shared/normalize.js';

const SEARCH_LIMIT = 20;
const FUSE_THRESHOLD = 0.6;

export class SteamProvider implements MetadataProvider {
  readonly name = 'steam';

  constructor(
    private readonly client: SteamHttpClient = defaultClient,
    private readonly indexSearcher: SteamIndexSearcher | null = steamIndexService,
  ) {}

  async search(query: string): Promise<SearchResult[]> {
    const normalized = query.trim();
    if (!normalized) return [];

    const local = await this.searchViaIndex(normalized);
    if (local.length > 0) return local;

    let response;
    try {
      response = await this.client.searchStore(normalized);
    } catch (err) {
      logger.warn({ err: (err as Error).message, query: normalized }, 'steam storesearch failed');
      return [];
    }

    const items = response?.items ?? [];
    if (items.length === 0) return [];

    const matchQuery = normalizeForMatch(normalized);
    const fuseItems = items.map((item) => ({
      ...item,
      matchName: normalizeForMatch(item.name),
    }));

    const fuse = new Fuse(fuseItems, {
      keys: ['matchName'],
      threshold: FUSE_THRESHOLD,
      includeScore: true,
      ignoreLocation: true,
      isCaseSensitive: false,
    });

    return fuse
      .search(matchQuery, { limit: SEARCH_LIMIT })
      .map(({ item, score }) => this.buildResult(item, score));
  }

  private async searchViaIndex(query: string): Promise<SearchResult[]> {
    if (!this.indexSearcher) return [];
    try {
      const candidates = await this.indexSearcher.searchByName(query);
      if (candidates.length === 0) return [];
      return candidates.map((c) => this.buildIndexResult(c));
    } catch (err) {
      logger.warn({ err: (err as Error).message, query }, 'steam index search failed; fallback to storesearch');
      return [];
    }
  }

  async getGame(remoteId: string): Promise<GameMetadata | null> {
    const appId = Number(remoteId);
    if (!Number.isInteger(appId) || appId <= 0) return null;

    try {
      const response = await this.client.fetchAppDetails(appId);
      const entry = response[String(appId)];
      if (!entry?.success || !entry.data) {
        logger.info({ appId }, 'steam appdetails: not success');
        return null;
      }
      return this.mapDetails(entry.data);
    } catch (err) {
      logger.warn({ appId, err: (err as Error).message }, 'steam appdetails failed');
      return null;
    }
  }

  private buildResult(item: SteamStoreSearchItem, score: number | undefined): SearchResult {
    return {
      providerName: this.name,
      remoteId: String(item.id),
      title: item.name,
      coverUrl: item.tiny_image,
      score: score !== undefined ? Math.round((1 - score) * 100) : undefined,
    };
  }

  private buildIndexResult(c: SteamIndexSearchResult): SearchResult {
    return {
      providerName: this.name,
      remoteId: String(c.appId),
      title: c.name,
      score: Math.round((1 - c.score) * 100),
    };
  }

  private mapDetails(data: SteamAppDetailsData): GameMetadata {
    const releaseYear = this.extractYear(data.release_date?.date);
    const screenshots = (data.screenshots ?? []).map((s) => ({
      url: s.path_full,
      thumbnailUrl: s.path_thumbnail,
    }));
    const videos = (data.movies ?? []).map((m) => {
      const hlsUrl = m.hls_h264 ?? undefined;
      const url = m.mp4?.max ?? m.mp4?.["480"] ?? m.webm?.max ?? m.webm?.["480"] ?? hlsUrl ?? '';
      return { url, thumbnailUrl: m.thumbnail, name: m.name, hlsUrl };
    }).filter((v) => v.url.length > 0);

    const genreNames = (data.genres ?? []).map((g) => g.description);
    const genres = normalizeGenres('steam', genreNames);

    return {
      remoteId: String(data.steam_appid),
      title: data.name,
      releaseYear,
      description: data.short_description ?? undefined,
      developers: data.developers ?? [],
      publishers: data.publishers ?? [],
      genres,
      coverUrl: `${STEAM_CDN_BASE}/${data.steam_appid}/library_600x900.jpg`,
      headerUrl: data.header_image ?? undefined,
      heroUrl: `${STEAM_CDN_BASE}/${data.steam_appid}/library_hero.jpg`,
      screenshots: screenshots.length > 0 ? screenshots : undefined,
      videos: videos.length > 0 ? videos : undefined,
    };
  }

  private extractYear(dateStr: string | undefined): number | undefined {
    if (!dateStr) return undefined;
    const match = /\d{4}/.exec(dateStr);
    if (!match) return undefined;
    const year = Number(match[0]);
    if (year < 1970 || year > 2100) return undefined;
    return year;
  }
}

export const steamProvider = new SteamProvider();