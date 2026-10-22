import { logger } from '../../logger/index.js';
import { getTitleVariants, normalizeForMatch } from '../../shared/normalize.js';
import type { SteamGridDbHttpClient } from './steamgriddb/steamgriddb.http.js';
import type { SteamGridDbGame, SteamGridDbImage, SteamGridDbImageQuery } from './steamgriddb/steamgriddb.http.types.js';

export type SteamGridDbArtworkKind = 'cover' | 'hero' | 'logo';

export interface SteamGridDbArtworkMatch {
  game: SteamGridDbGame | null;
  image: SteamGridDbImage;
}

export interface SteamGridDbArtworkQuery {
  steamAppId?: number;
  title: string;
  titleVariants?: string[];
  releaseYear?: number;
  kind: SteamGridDbArtworkKind;
}

type ArtworkClient = Pick<SteamGridDbHttpClient,
  | 'searchGameByName'
  | 'getGridsBySteamAppId'
  | 'getHeroesBySteamAppId'
  | 'getLogosBySteamAppId'
  | 'getGridsByGameId'
  | 'getHeroesByGameId'
>;

const BASE_QUERY: SteamGridDbImageQuery = { types: ['static'], nsfw: 'false', humor: 'false' };
const ART_STYLES = ['alternate', 'blurred'];
const LOGO_STYLES = ['official', 'white', 'black', 'transparent'];

function titleKey(value: string): string {
  return normalizeForMatch(value.normalize('NFD').replace(/\p{M}/gu, ''));
}

function releaseYear(game: SteamGridDbGame): number | undefined {
  if (!game.release_date || game.release_date <= 0) return undefined;
  const year = new Date(game.release_date * 1000).getUTCFullYear();
  return year >= 1970 && year <= 2100 ? year : undefined;
}

function yearCompatible(candidate: number | undefined, expected: number | undefined): boolean {
  if (expected === undefined) return true;
  return candidate !== undefined && Math.abs(candidate - expected) <= 1;
}

function selectBestImage(images: SteamGridDbImage[]): SteamGridDbImage | null {
  const safe = images.filter((image) => !image.humor && !image.nsfw);
  if (!safe.length) return null;
  const official = safe.filter((image) => image.style === 'official');
  const pool = official.length ? official : safe;
  return pool.reduce((best, image) => {
    if (image.score > best.score) return image;
    if (image.score === best.score && image.width > best.width) return image;
    return best;
  });
}

function queryFor(kind: SteamGridDbArtworkKind): SteamGridDbImageQuery {
  return {
    ...BASE_QUERY,
    styles: kind === 'logo' ? LOGO_STYLES : ART_STYLES,
  };
}

export class SteamGridDbFallback {
  private readonly gameCache = new Map<string, { expiresAt: number; game: SteamGridDbGame | null }>();
  private readonly artworkCache = new Map<string, { expiresAt: number; match: SteamGridDbArtworkMatch | null }>();

  constructor(
    private readonly client: ArtworkClient | null,
    private readonly now: () => number = Date.now,
    private readonly gameCacheTtlMs = 15 * 60_000,
    private readonly maxCachedGames = 1000,
  ) {}

  async findGame(title: string, expectedYear?: number): Promise<SteamGridDbGame | null> {
    if (!this.client) return null;
    const variants = [...new Set(getTitleVariants(title).map((value) => value.trim()).filter(Boolean))];
    for (const variant of variants) {
      const cacheKey = `${titleKey(variant)}:${expectedYear ?? ''}`;
      const cached = this.gameCache.get(cacheKey);
      if (cached && cached.expiresAt > this.now()) {
        if (cached.game) return cached.game;
        continue;
      }
      try {
        const games = await this.client.searchGameByName(variant);
        const exact = games
          .filter((game) => titleKey(game.name) === titleKey(variant))
          .filter((game) => yearCompatible(releaseYear(game), expectedYear))
          .sort((left, right) => {
            const yearDistance = expectedYear === undefined
              ? 0
              : Math.abs((releaseYear(left) ?? expectedYear) - expectedYear)
                - Math.abs((releaseYear(right) ?? expectedYear) - expectedYear);
            return yearDistance || Number(right.verified) - Number(left.verified);
          });
        const game = exact[0] ?? null;
        this.rememberGame(cacheKey, game);
        if (game) return game;
      } catch (error) {
        logger.warn({ title: variant, err: (error as Error).message }, 'steamgriddb name search failed');
      }
    }
    return null;
  }

  async findArtwork(query: SteamGridDbArtworkQuery): Promise<SteamGridDbArtworkMatch | null> {
    if (!this.client) return null;
    const cacheKey = `${query.kind}:${query.steamAppId ?? ''}:${[query.title, ...(query.titleVariants ?? [])].map(titleKey).join('|')}:${query.releaseYear ?? ''}`;
    const cached = this.artworkCache.get(cacheKey);
    if (cached && cached.expiresAt > this.now()) return cached.match;
    const match = await this.lookupArtwork(query);
    this.rememberArtwork(cacheKey, match);
    return match;
  }

  private async lookupArtwork(query: SteamGridDbArtworkQuery): Promise<SteamGridDbArtworkMatch | null> {
    const imageQuery = queryFor(query.kind);
    if (query.steamAppId) {
      const appImages = await this.imagesBySteamAppId(query.steamAppId, query.kind, imageQuery);
      const image = selectBestImage(appImages);
      if (image) return { game: null, image };
    }

    if (query.kind === 'logo') return null;
    for (const title of [query.title, ...(query.titleVariants ?? [])]) {
      const game = await this.findGame(title, query.releaseYear);
      if (!game) continue;
      const images = query.kind === 'cover'
        ? await this.imagesByGameId(game.id, 'cover', imageQuery)
        : await this.imagesByGameId(game.id, 'hero', imageQuery);
      const image = selectBestImage(images);
      if (image) return { game, image };
    }
    return null;
  }

  private async imagesBySteamAppId(
    steamAppId: number,
    kind: SteamGridDbArtworkKind,
    query: SteamGridDbImageQuery,
  ): Promise<SteamGridDbImage[]> {
    try {
      if (kind === 'cover') return await this.client!.getGridsBySteamAppId(steamAppId, query);
      if (kind === 'hero') return await this.client!.getHeroesBySteamAppId(steamAppId, query);
      return await this.client!.getLogosBySteamAppId(steamAppId, query);
    } catch (error) {
      logger.warn({ steamAppId, kind, err: (error as Error).message }, 'steamgriddb artwork lookup failed');
      return [];
    }
  }

  private async imagesByGameId(
    gameId: number,
    kind: 'cover' | 'hero',
    query: SteamGridDbImageQuery,
  ): Promise<SteamGridDbImage[]> {
    try {
      return kind === 'cover'
        ? await this.client!.getGridsByGameId(gameId, query)
        : await this.client!.getHeroesByGameId(gameId, query);
    } catch (error) {
      logger.warn({ gameId, kind, err: (error as Error).message }, 'steamgriddb artwork lookup failed');
      return [];
    }
  }

  private rememberGame(key: string, game: SteamGridDbGame | null): void {
    this.gameCache.delete(key);
    this.gameCache.set(key, { game, expiresAt: this.now() + this.gameCacheTtlMs });
    while (this.gameCache.size > this.maxCachedGames) {
      const oldest = this.gameCache.keys().next().value;
      if (oldest === undefined) break;
      this.gameCache.delete(oldest);
    }
  }

  private rememberArtwork(key: string, match: SteamGridDbArtworkMatch | null): void {
    this.artworkCache.delete(key);
    this.artworkCache.set(key, { match, expiresAt: this.now() + this.gameCacheTtlMs });
    while (this.artworkCache.size > this.maxCachedGames) {
      const oldest = this.artworkCache.keys().next().value;
      if (oldest === undefined) break;
      this.artworkCache.delete(oldest);
    }
  }
}
