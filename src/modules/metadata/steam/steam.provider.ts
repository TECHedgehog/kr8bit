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
import type { SteamAppDetailsData, SteamDeckCompatibility, SteamStoreSearchItem } from './steam.http.types.js';
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

    return this.rankStoreSearchResults(response?.items ?? [], normalized);
  }

  /**
   * Live storesearch bypassing the local index. Used as a fallback when a
   * previously-matched appId becomes stale (e.g. superseded edition) and
   * appdetails returns success:false.
   */
  async resolveByStoreSearch(query: string): Promise<SearchResult[]> {
    const normalized = query.trim();
    if (!normalized) return [];

    let response;
    try {
      response = await this.client.searchStore(normalized);
    } catch (err) {
      logger.warn({ err: (err as Error).message, query: normalized }, 'steam fallback storesearch failed');
      return [];
    }

    return this.rankStoreSearchResults(response?.items ?? [], normalized);
  }

  private rankStoreSearchResults(items: SteamStoreSearchItem[], query: string): SearchResult[] {
    if (items.length === 0) return [];

    const matchQuery = normalizeForMatch(query);
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
      const [response, deckCompat] = await Promise.all([
        this.client.fetchAppDetails(appId),
        this.client.fetchDeckCompatibility(appId).catch((err) => {
          logger.warn({ appId, err: (err as Error).message }, 'steam deck compatibility failed');
          return null;
        }),
      ]);
      const entry = response[String(appId)];
      if (!entry?.success || !entry.data) {
        logger.info({ appId }, 'steam appdetails: not success');
        return null;
      }
      return this.mapDetails(entry.data, deckCompat);
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

  private mapDetails(data: SteamAppDetailsData, deckCompat?: SteamDeckCompatibility | null): GameMetadata {
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

    const steamDeckCompat = deckCompat
      ? {
          category: deckCompat.resolved_category,
          items: deckCompat.resolved_items.map((item) => ({
            displayType: item.display_type,
            locToken: item.loc_token,
          })),
        }
      : undefined;

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
      steamDeckCompat,
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