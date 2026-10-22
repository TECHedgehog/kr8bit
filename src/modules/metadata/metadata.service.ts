import { logger } from '../../logger/index.js';
import { MatchStatus, STEAM_PROVIDER_NAME } from '../../shared/enums.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { libraryRepository } from '../library/library.repository.js';
import type { Game, GameUpdateInput } from '../library/library.types.js';
import type { MetadataProvider, SearchResult, GameMetadata } from '../../shared/types.js';
import { providerMatchRepository } from '../metadata/provider-match.repository.js';
import type { ProviderRegistry } from '../metadata/provider-registry.js';
import { providerRegistry as defaultRegistry } from '../metadata/provider-registry.js';
import { artworkService, type ArtworkService, type ArtworkKind } from '../artwork/artwork.service.js';
import { steamGridDbHttpClient, type SteamGridDbHttpClient } from '../artwork/steamgriddb/steamgriddb.http.js';
import type {
  SteamGridDbGame,
  SteamGridDbImage,
  SteamGridDbImageQuery,
} from '../artwork/steamgriddb/steamgriddb.http.types.js';
import { getTitleVariants, normalizeForMatch, normalizeGameName } from '../../shared/normalize.js';

function selectBestImage(images: SteamGridDbImage[]): SteamGridDbImage | undefined {
  if (images.length === 0) return undefined;
  const safe = images.filter((img) => !img.humor && !img.nsfw);
  const pool = safe.length > 0 ? safe : images;
  const official = pool.filter((img) => img.style === 'official');
  const ranked = official.length > 0 ? official : pool;
  return ranked.reduce((best, img) => {
    if (img.score > best.score) return img;
    if (img.score === best.score && img.width > best.width) return img;
    return best;
  });
}

function titleKey(title: string): string {
  return normalizeForMatch(title.normalize('NFD').replace(/\p{M}/gu, ''));
}

function isYearCompatible(candidateYear: number | undefined, expectedYear: number | undefined): boolean {
  if (expectedYear === undefined) return true;
  return candidateYear !== undefined && Math.abs(candidateYear - expectedYear) <= 1;
}

function selectExactYearMatch<T>(
  candidates: T[],
  title: string,
  expectedYear: number | undefined,
  candidateTitle: (candidate: T) => string,
  candidateYear: (candidate: T) => number | undefined,
): T | undefined {
  const expectedTitle = titleKey(title);
  if (!expectedTitle) return undefined;

  return candidates
    .filter((candidate) => titleKey(candidateTitle(candidate)) === expectedTitle)
    .filter((candidate) => isYearCompatible(candidateYear(candidate), expectedYear))
    .sort((left, right) => {
      if (expectedYear === undefined) return 0;
      return Math.abs(candidateYear(left)! - expectedYear) - Math.abs(candidateYear(right)! - expectedYear);
    })[0];
}

function steamGridDbReleaseYear(game: SteamGridDbGame): number | undefined {
  if (!game.release_date || game.release_date <= 0) return undefined;
  const year = new Date(game.release_date * 1000).getUTCFullYear();
  return year >= 1970 && year <= 2100 ? year : undefined;
}

const MANUAL_MATCH_SCORE = 100;
const STEAMGRIDDB_BASE_QUERY: SteamGridDbImageQuery = {
  types: ['static'],
  nsfw: 'false',
  humor: 'false',
};
const STEAMGRIDDB_ART_STYLES = ['alternate', 'blurred'];
const STEAMGRIDDB_LOGO_STYLES = ['official', 'white', 'black', 'transparent'];

type SteamGridDbArtworkClient = Pick<SteamGridDbHttpClient,
  | 'searchGameByName'
  | 'getGridsBySteamAppId'
  | 'getHeroesBySteamAppId'
  | 'getLogosBySteamAppId'
  | 'getGridsByGameId'
  | 'getHeroesByGameId'
>;

export interface MetadataDeps {
  providers: ProviderRegistry;
  artwork: ArtworkService;
  now: () => Date;
  /** SteamGridDB enrichment client; null/undefined disables enrichment. */
  steamGridDb?: SteamGridDbArtworkClient | null;
}

const defaultMetadataDeps: MetadataDeps = {
  providers: defaultRegistry,
  artwork: artworkService,
  now: () => new Date(),
  steamGridDb: steamGridDbHttpClient,
};

export interface AssignedMetadata {
  game: Game;
  fetchedArtwork: { header: boolean; cover: boolean };
  providerName: string;
}

export interface ValidationResult {
  gameId: string;
  results: SearchResult[];
}

export type ArtworkLookup =
  | { kind: 'cached'; bytes: Buffer; contentType: string }
  | { kind: 'remote'; url: string };

export class MetadataService {
  constructor(private readonly deps: MetadataDeps = defaultMetadataDeps) {}

  async searchForGame(
    gameId: string,
    query: string,
    providerName?: string,
  ): Promise<ValidationResult> {
    const game = await libraryRepository.findById(gameId);
    if (!query.trim()) return { gameId: game.id, results: [] };
    const normalized = normalizeGameName(query).query;
    if (!normalized) return { gameId: game.id, results: [] };

    const providers = this.selectProviders(providerName);
    const results: SearchResult[] = [];
    for (const provider of providers) {
      try {
        const partial = await provider.search(normalized);
        results.push(...partial);
      } catch (err) {
        logger.warn(
          { err: (err as Error).message, provider: provider.name, query: normalized },
          'metadata search failed',
        );
      }
    }
    return { gameId: game.id, results };
  }

  async assign(gameId: string, providerName: string, remoteId: string): Promise<AssignedMetadata> {
    const game = await libraryRepository.findById(gameId);
    const provider = this.deps.providers.resolve(providerName);
    if (!provider) {
      throw new ValidationError(`unknown provider: ${providerName}`);
    }

    const metadata = await provider.getGame(remoteId);
    if (!metadata) {
      throw new NotFoundError('RemoteGame', remoteId);
    }

    const { game: updated, fetchedArtwork } = await this.applyMetadataToGame(game, metadata, provider, {
      isManual: true,
      now: this.deps.now(),
    });

    logger.info(
      { gameId: game.id, provider: provider.name, remoteId, fetchedArtwork },
      'metadata assigned',
    );

    return {
      game: updated,
      fetchedArtwork,
      providerName: provider.name,
    };
  }

  async refresh(gameId: string): Promise<Game | null> {
    const game = await libraryRepository.findById(gameId);

    const primary = await providerMatchRepository.findPrimaryByGame(gameId);
    if (primary) {
      return this.refreshViaProviderMatch(game, primary.providerName, primary.remoteId);
    }

    if (!game.steamAppId) return null;
    return this.refreshSteam(game);
  }

  async recheckArtwork(gameId: string): Promise<boolean> {
    const game = await libraryRepository.findById(gameId);
    const primary = await providerMatchRepository.findPrimaryByGame(gameId);
    const artworkUrls: { kind: ArtworkKind; url: string | null }[] = [
      { kind: 'cover', url: game.coverUrl },
      { kind: 'header', url: game.headerUrl },
      { kind: 'hero', url: game.heroUrl },
      { kind: 'logo', url: game.logoUrl },
    ];
    const requested = artworkUrls.filter((artwork) => artwork.url);
    if (!requested.length) return true;

    if (primary && primary.providerName !== STEAM_PROVIDER_NAME) {
      const results = await Promise.all(requested.map(({ kind, url }) =>
        this.deps.artwork.downloadToCacheGeneric(primary.providerName, primary.remoteId, kind, url),
      ));
      return results.every(Boolean);
    }

    if (!game.steamAppId) return false;
    const results = await Promise.all(requested.map(({ kind, url }) =>
      this.deps.artwork.downloadToCache(game.steamAppId!, kind, url),
    ));
    return results.every(Boolean);
  }

  async unlink(gameId: string): Promise<Game> {
    const game = await libraryRepository.findById(gameId);

    const primary = await providerMatchRepository.findPrimaryByGame(gameId);
    if (primary) {
      await this.deps.artwork.removeGeneric(primary.providerName, primary.remoteId);
      await providerMatchRepository.deleteByGame(gameId);
    } else if (game.steamAppId) {
      await this.deps.artwork.remove(game.steamAppId);
    }

    return libraryRepository.update(game.id, {
      steamAppId: null,
      title: null,
      releaseYear: null,
      description: null,
      developers: [],
      publishers: [],
      genres: [],
      coverUrl: null,
      headerUrl: null,
      heroUrl: null,
      logoUrl: null,
      screenshots: [],
      videos: [],
      steamDeckCategory: null,
      steamDeckItems: [],
      matchStatus: MatchStatus.PENDING,
      matchScore: null,
      matchedAt: null,
    });
  }

  artwork(): ArtworkService {
    return this.deps.artwork;
  }

  artworkKind(input: string): ArtworkKind | null {
    if (input === 'header' || input === 'cover' || input === 'hero' || input === 'logo') return input;
    return null;
  }

  async primaryProviderMatch(gameId: string) {
    return providerMatchRepository.findPrimaryByGame(gameId);
  }

  providerNames(): string[] {
    return this.deps.providers.names();
  }

  /**
   * Resolve artwork for HTTP serving: cached bytes when available,
   * otherwise the remote URL for a redirect. Throws NotFoundError when
   * the game has no artwork of that kind.
   */
  async artworkFor(gameId: string, kind: ArtworkKind): Promise<ArtworkLookup> {
    const game = await libraryRepository.findById(gameId);
    const primary = await providerMatchRepository.findPrimaryByGame(gameId);

    if (primary && primary.providerName !== STEAM_PROVIDER_NAME) {
      const remoteUrl = remoteUrlFor(game, kind);
      if (!remoteUrl) throw new NotFoundError('Artwork', `${gameId}/${kind}`);
      const cached = await this.deps.artwork.readWithContentTypeGeneric(
        primary.providerName,
        primary.remoteId,
        kind,
      );
      if (cached) return { kind: 'cached', bytes: cached.bytes, contentType: cached.contentType };
      return { kind: 'remote', url: remoteUrl };
    }

    if (!game.steamAppId) throw new NotFoundError('Artwork', `${gameId}/${kind}`);
    const remoteUrl = remoteUrlFor(game, kind);
    if (!remoteUrl) throw new NotFoundError('Artwork', `${gameId}/${kind}`);

    const cached = await this.deps.artwork.readWithContentType(game.steamAppId, kind);
    if (cached) return { kind: 'cached', bytes: cached.bytes, contentType: cached.contentType };
    return { kind: 'remote', url: remoteUrl };
  }

  private selectProviders(providerName?: string): MetadataProvider[] {
    if (!providerName) return this.deps.providers.order();
    const resolved = this.deps.providers.resolve(providerName);
    if (!resolved) {
      throw new ValidationError(`unknown provider: ${providerName}`);
    }
    return [resolved];
  }

  private async refreshViaProviderMatch(
    game: Game,
    providerName: string,
    remoteId: string,
  ): Promise<Game | null> {
    const provider = this.deps.providers.resolve(providerName);
    if (!provider) {
      logger.warn({ providerName }, 'refresh: provider missing from registry');
      return null;
    }
    const metadata = await provider.getGame(remoteId);
    if (!metadata) return null;

    const { game: updated } = await this.applyMetadataToGame(game, metadata, provider, {
      isManual: false,
      now: this.deps.now(),
    });
    return updated;
  }

  private async refreshSteam(game: Game): Promise<Game | null> {
    if (!game.steamAppId) return null;
    const provider = this.deps.providers.resolve(STEAM_PROVIDER_NAME);
    if (!provider) {
      logger.warn({}, 'refresh: steam provider missing from registry');
      return null;
    }
    const metadata = await provider.getGame(String(game.steamAppId));
    if (metadata) {
      const { game: updated } = await this.applyMetadataToGame(game, metadata, provider, {
        isManual: false,
        now: this.deps.now(),
      });
      return updated;
    }

    if (game.matchStatus === MatchStatus.MANUAL || !game.entryName) {
      return null;
    }

    // Optional provider capability: live search fallback to correct a
    // stale appId (no interface cast to a concrete provider).
    if (!provider.resolveByStoreSearch) return null;
    const fallbackResults = await provider.resolveByStoreSearch(game.entryName);
    for (const candidate of fallbackResults) {
      const fallbackMetadata = await provider.getGame(candidate.remoteId);
      if (!fallbackMetadata) continue;

      logger.info(
        { gameId: game.id, oldAppId: game.steamAppId, newAppId: candidate.remoteId, title: candidate.title },
        'refresh: correcting stale steam appId',
      );
      await libraryRepository.update(game.id, { steamAppId: Number(candidate.remoteId) });
      const { game: updated } = await this.applyMetadataToGame(game, fallbackMetadata, provider, {
        isManual: false,
        now: this.deps.now(),
      });
      return updated;
    }

    return null;
  }

  private async applyMetadataToGame(
    game: Game,
    metadata: GameMetadata,
    provider: MetadataProvider,
    options: { isManual: boolean; now: Date },
  ): Promise<{ game: Game; fetchedArtwork: { header: boolean; cover: boolean } }> {
    const isSteam = provider.name === STEAM_PROVIDER_NAME;
    const releaseYear = metadata.releaseYear ?? game.releaseYear ?? undefined;
    const artworkTitleVariants = [...new Set([
      ...getTitleVariants(metadata.title),
      ...getTitleVariants(normalizeGameName(game.entryName).query),
    ])];

    const artworkState = isSteam
      ? await this.cacheSteamArtwork(metadata, releaseYear, artworkTitleVariants)
      : await this.cacheGenericArtwork(provider.name, metadata, releaseYear, artworkTitleVariants);

    const updatePayload: GameUpdateInput = {
      title: metadata.title,
      releaseYear: metadata.releaseYear ?? null,
      description: metadata.description ?? null,
      developers: metadata.developers,
      publishers: metadata.publishers,
      genres: [...new Set([...game.genres, ...metadata.genres])],
      coverUrl: artworkState.coverUrl,
      headerUrl: artworkState.headerUrl,
      heroUrl: artworkState.heroUrl,
      logoUrl: artworkState.logoUrl,
      screenshots: metadata.screenshots ?? [],
      videos: metadata.videos ?? [],
      steamDeckCategory: metadata.steamDeckCompat?.category ?? null,
      steamDeckItems: metadata.steamDeckCompat?.items ?? [],
      matchedAt: options.now,
    };

    if (options.isManual) {
      updatePayload.steamAppId = isSteam ? Number(metadata.remoteId) : null;
      updatePayload.matchStatus = MatchStatus.MANUAL;
      updatePayload.matchScore = MANUAL_MATCH_SCORE;
    }

    const updated = await libraryRepository.update(game.id, updatePayload);

    if (options.isManual && !isSteam) {
      await providerMatchRepository.upsert({
        gameId: game.id,
        providerName: provider.name,
        remoteId: metadata.remoteId,
        matchScore: MANUAL_MATCH_SCORE,
        isPrimary: true,
        matchedAt: options.now,
      });
    }

    return {
      game: updated,
      fetchedArtwork: { header: artworkState.headerCached, cover: artworkState.coverCached },
    };
  }

  private async cacheSteamArtwork(
    metadata: GameMetadata,
    releaseYear?: number,
    titleVariants: string[] = getTitleVariants(metadata.title),
  ): Promise<ArtworkUrls> {
    const appId = Number(metadata.remoteId);
    const coverCached = await this.deps.artwork.downloadToCache(appId, 'cover', metadata.coverUrl);
    const heroResult = await this.deps.artwork.downloadToCache(appId, 'header', metadata.heroUrl);
    const steamHeroCached = !!heroResult;
    const sgdb = await this.enrichWithSteamGridDb(
      appId,
      titleVariants,
      releaseYear,
      !!coverCached,
      steamHeroCached,
    );
    let selectedHeaderUrl = steamHeroCached ? metadata.heroUrl ?? null : sgdb.heroUrl;
    let selectedHeroUrl = steamHeroCached ? metadata.heroUrl ?? null : sgdb.heroUrl;
    let headerCached = !!heroResult;
    if (!steamHeroCached && sgdb.heroUrl) {
      headerCached = !!await this.deps.artwork.downloadToCache(appId, 'header', sgdb.heroUrl);
    }
    let coverUrl = coverCached ? metadata.coverUrl ?? null : sgdb.gridUrl;

    if (!coverUrl || !selectedHeroUrl) {
      const igdbMetadata = await this.findIgdbArtwork(titleVariants, releaseYear);
      if (!coverUrl && igdbMetadata?.coverUrl) {
        const cached = await this.deps.artwork.downloadToCache(appId, 'cover', igdbMetadata.coverUrl);
        if (cached) coverUrl = igdbMetadata.coverUrl;
      }

      const igdbHeroUrl = igdbMetadata?.heroUrl ?? igdbMetadata?.headerUrl;
      if (!selectedHeroUrl && igdbHeroUrl) {
        const [headerImageCached, heroImageCached] = await Promise.all([
          this.deps.artwork.downloadToCache(appId, 'header', igdbHeroUrl),
          this.deps.artwork.downloadToCache(appId, 'hero', igdbHeroUrl),
        ]);
        if (headerImageCached) {
          selectedHeaderUrl = igdbHeroUrl;
          headerCached = true;
        }
        if (heroImageCached) selectedHeroUrl = igdbHeroUrl;
      }
    }

    if (!selectedHeroUrl && metadata.headerUrl) {
      const [headerImageCached, heroImageCached] = await Promise.all([
        this.deps.artwork.downloadToCache(appId, 'header', metadata.headerUrl),
        this.deps.artwork.downloadToCache(appId, 'hero', metadata.headerUrl),
      ]);
      if (headerImageCached) {
        selectedHeaderUrl = metadata.headerUrl;
        headerCached = true;
      }
      if (heroImageCached) selectedHeroUrl = metadata.headerUrl;
    }

    return {
      coverCached: !!coverUrl,
      headerCached,
      coverUrl,
      headerUrl: selectedHeaderUrl,
      heroUrl: selectedHeroUrl,
      logoUrl: sgdb.logoUrl,
    };
  }

  private async cacheGenericArtwork(
    providerName: string,
    metadata: GameMetadata,
    releaseYear?: number,
    titleVariants: string[] = getTitleVariants(metadata.title),
  ): Promise<ArtworkUrls> {
    const initialHeaderCache = await this.deps.artwork.downloadToCacheGeneric(
      providerName,
      metadata.remoteId,
      'header',
      metadata.headerUrl,
    );
    const coverCached = await this.deps.artwork.downloadToCacheGeneric(
      providerName,
      metadata.remoteId,
      'cover',
      metadata.coverUrl,
    );
    const initialHeroCache = await this.deps.artwork.downloadToCacheGeneric(
      providerName,
      metadata.remoteId,
      'hero',
      metadata.heroUrl,
    );
    let headerCached = !!initialHeaderCache;
    let heroCached = !!initialHeroCache;
    let headerUrl = headerCached ? metadata.headerUrl ?? null : null;
    let heroUrl = heroCached ? metadata.heroUrl ?? null : null;

    if (!headerCached || !heroCached) {
      const fallbackHeroUrl = await this.findSteamGridDbHeroByName(titleVariants, releaseYear);
      if (fallbackHeroUrl) {
        const [fallbackHeaderCache, fallbackHeroCache] = await Promise.all([
          headerCached
            ? Promise.resolve(null)
            : this.deps.artwork.downloadToCacheGeneric(providerName, metadata.remoteId, 'header', fallbackHeroUrl),
          heroCached
            ? Promise.resolve(null)
            : this.deps.artwork.downloadToCacheGeneric(providerName, metadata.remoteId, 'hero', fallbackHeroUrl),
        ]);
        if (fallbackHeaderCache) {
          headerCached = true;
          headerUrl = fallbackHeroUrl;
        }
        if (fallbackHeroCache) {
          heroCached = true;
          heroUrl = fallbackHeroUrl;
        }
      }
    }

    return {
      coverCached: !!coverCached,
      headerCached,
      coverUrl: coverCached ? (metadata.coverUrl ?? null) : null,
      headerUrl,
      heroUrl,
      logoUrl: null,
    };
  }

  private async enrichWithSteamGridDb(
    steamAppId: number,
    titleVariants: string[],
    releaseYear: number | undefined,
    coverDownloaded = false,
    heroDownloaded = false,
  ): Promise<{ gridUrl: string | null; heroUrl: string | null; logoUrl: string | null }> {
    const client = this.deps.steamGridDb ?? null;
    if (!client) return { gridUrl: null, heroUrl: null, logoUrl: null };
    const [grids, heroes, logos] = await Promise.all([
      coverDownloaded
        ? Promise.resolve([])
        : client.getGridsBySteamAppId(steamAppId, {
            ...STEAMGRIDDB_BASE_QUERY,
            styles: STEAMGRIDDB_ART_STYLES,
          }),
      heroDownloaded
        ? Promise.resolve([])
        : client.getHeroesBySteamAppId(steamAppId, {
            ...STEAMGRIDDB_BASE_QUERY,
            styles: STEAMGRIDDB_ART_STYLES,
          }),
      client.getLogosBySteamAppId(steamAppId, {
        ...STEAMGRIDDB_BASE_QUERY,
        styles: STEAMGRIDDB_LOGO_STYLES,
      }),
    ]);
    let gridUrl = coverDownloaded ? null : await this.cacheBestSteamGridDbImage(steamAppId, 'cover', grids);
    let heroUrl = heroDownloaded ? null : await this.cacheBestSteamGridDbImage(steamAppId, 'hero', heroes);
    const logoUrl = await this.cacheBestSteamGridDbImage(steamAppId, 'logo', logos);

    if ((!coverDownloaded && !gridUrl) || (!heroDownloaded && !heroUrl)) {
      const game = await this.findSteamGridDbGame(titleVariants, releaseYear);
      if (game) {
        const [nameGrids, nameHeroes] = await Promise.all([
          !coverDownloaded && !gridUrl
            ? client.getGridsByGameId(game.id, {
                ...STEAMGRIDDB_BASE_QUERY,
                styles: STEAMGRIDDB_ART_STYLES,
              })
            : Promise.resolve([]),
          !heroDownloaded && !heroUrl
            ? client.getHeroesByGameId(game.id, {
                ...STEAMGRIDDB_BASE_QUERY,
                styles: STEAMGRIDDB_ART_STYLES,
              })
            : Promise.resolve([]),
        ]);
        gridUrl ??= await this.cacheBestSteamGridDbImage(steamAppId, 'cover', nameGrids);
        heroUrl ??= await this.cacheBestSteamGridDbImage(steamAppId, 'hero', nameHeroes);
      }
    }

    return {
      gridUrl,
      heroUrl,
      logoUrl,
    };
  }

  private async cacheBestSteamGridDbImage(
    steamAppId: number,
    kind: ArtworkKind,
    images: SteamGridDbImage[],
  ): Promise<string | null> {
    const image = selectBestImage(images);
    if (!image) return null;
    const cached = await this.deps.artwork.downloadToCache(steamAppId, kind, image.url);
    return cached ? image.url : null;
  }

  private async findSteamGridDbGame(
    titleVariants: string[],
    releaseYear?: number,
  ): Promise<SteamGridDbGame | null> {
    const client = this.deps.steamGridDb ?? null;
    if (!client) return null;
    for (const title of titleVariants) {
      try {
        const games = await client.searchGameByName(title);
        const exactMatches = games
          .filter((game) => titleKey(game.name) === titleKey(title))
          .filter((game) => isYearCompatible(steamGridDbReleaseYear(game), releaseYear))
          .sort((left, right) => {
            const leftYear = steamGridDbReleaseYear(left);
            const rightYear = steamGridDbReleaseYear(right);
            const yearDistance = releaseYear === undefined
              ? 0
              : Math.abs((leftYear ?? releaseYear) - releaseYear)
                - Math.abs((rightYear ?? releaseYear) - releaseYear);
            return yearDistance || Number(right.verified) - Number(left.verified);
          });
        if (exactMatches[0]) return exactMatches[0];
      } catch (error) {
        logger.warn({ title, err: (error as Error).message }, 'steamgriddb name search failed');
      }
    }
    return null;
  }

  private async findSteamGridDbHeroByName(
    titleVariants: string[],
    releaseYear?: number,
  ): Promise<string | null> {
    const client = this.deps.steamGridDb ?? null;
    if (!client) return null;
    const game = await this.findSteamGridDbGame(titleVariants, releaseYear);
    if (!game) return null;
    try {
      const images = await client.getHeroesByGameId(game.id, {
        ...STEAMGRIDDB_BASE_QUERY,
        styles: STEAMGRIDDB_ART_STYLES,
      });
      return selectBestImage(images)?.url ?? null;
    } catch (error) {
      logger.warn({ titleVariants, gameId: game.id, err: (error as Error).message }, 'steamgriddb hero lookup failed');
      return null;
    }
  }

  private async findIgdbArtwork(titleVariants: string[], releaseYear?: number): Promise<GameMetadata | null> {
    const igdb = this.deps.providers.resolve('igdb');
    if (!igdb) return null;
    for (const title of titleVariants) {
      try {
        const results = await igdb.search(title);
        const match = selectExactYearMatch(
          results,
          title,
          releaseYear,
          (result) => result.title,
          (result) => result.releaseYear,
        );
        if (!match) continue;
        const metadata = await igdb.getGame(match.remoteId);
        if (metadata) return metadata;
      } catch (error) {
        logger.warn({ title, err: (error as Error).message }, 'igdb artwork fallback failed');
      }
    }
    return null;
  }
}

interface ArtworkUrls {
  coverCached: boolean;
  headerCached: boolean;
  coverUrl: string | null;
  headerUrl: string | null;
  heroUrl: string | null;
  logoUrl: string | null;
}

function remoteUrlFor(game: Game, kind: ArtworkKind): string | null {
  switch (kind) {
    case 'cover':
      return game.coverUrl;
    case 'header':
      return game.headerUrl;
    case 'hero':
      return game.heroUrl;
    case 'logo':
      return game.logoUrl;
  }
}

export const metadataService = new MetadataService();
