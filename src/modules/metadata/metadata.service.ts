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
import { steamGridDbHttpClient } from '../artwork/steamgriddb/steamgriddb.http.js';
import type { SteamGridDbImage, SteamGridDbImageQuery } from '../artwork/steamgriddb/steamgriddb.http.types.js';
import { normalizeGameName } from '../../shared/normalize.js';
import { SteamProvider } from './steam/steam.provider.js';

export { STEAM_PROVIDER_NAME };
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
export interface MetadataDeps {
  providers: ProviderRegistry;
  artwork: ArtworkService;
  now: () => Date;
}

export const defaultMetadataDeps: MetadataDeps = {
  providers: defaultRegistry,
  artwork: artworkService,
  now: () => new Date(),
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

    const steamProvider = provider as SteamProvider;
    const fallbackResults = await steamProvider.resolveByStoreSearch(game.entryName);
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
    let headerCached: string | null = null;
    let coverCached: string | null = null;
    let heroCached: string | null = null;
    let sgdb = { gridUrl: null as string | null, heroUrl: null as string | null, logoUrl: null as string | null };
    let steamHeroCached = false;

    if (isSteam) {
      const appId = Number(metadata.remoteId);
      coverCached = await this.deps.artwork.downloadToCache(appId, 'cover', metadata.coverUrl);
      const heroResult = await this.deps.artwork.downloadToCache(appId, 'header', metadata.heroUrl);
      steamHeroCached = !!heroResult;
      sgdb = await this.enrichWithSteamGridDb(appId, !!coverCached, steamHeroCached);
      headerCached = heroResult;
      if (!steamHeroCached && sgdb.heroUrl) {
        headerCached = await this.deps.artwork.downloadToCache(appId, 'header', sgdb.heroUrl);
      }
    } else {
      headerCached = await this.deps.artwork.downloadToCacheGeneric(
        provider.name,
        metadata.remoteId,
        'header',
        metadata.headerUrl,
      );
      coverCached = await this.deps.artwork.downloadToCacheGeneric(
        provider.name,
        metadata.remoteId,
        'cover',
        metadata.coverUrl,
      );
      heroCached = await this.deps.artwork.downloadToCacheGeneric(
        provider.name,
        metadata.remoteId,
        'hero',
        metadata.heroUrl,
      );
    }

    const updatePayload: GameUpdateInput = {
      title: metadata.title,
      releaseYear: metadata.releaseYear ?? null,
      description: metadata.description ?? null,
      developers: metadata.developers,
      publishers: metadata.publishers,
      genres: metadata.genres,
      coverUrl: coverCached ? (metadata.coverUrl ?? null) : (sgdb.gridUrl ?? metadata.coverUrl ?? null),
      headerUrl: steamHeroCached ? (metadata.heroUrl ?? null) : (sgdb.heroUrl ?? metadata.headerUrl ?? null),
      heroUrl: isSteam
        ? (steamHeroCached ? (metadata.heroUrl ?? null) : (sgdb.heroUrl ?? null))
        : (heroCached ? (metadata.heroUrl ?? null) : null),
      logoUrl: sgdb.logoUrl,
      screenshots: metadata.screenshots ?? [],
      videos: metadata.videos ?? [],
      matchedAt: options.now,
    };

    if (options.isManual) {
      updatePayload.steamAppId = isSteam ? Number(metadata.remoteId) : null;
      updatePayload.matchStatus = MatchStatus.MANUAL;
      updatePayload.matchScore = 100;
    }

    const updated = await libraryRepository.update(game.id, updatePayload);

    if (options.isManual && !isSteam) {
      await providerMatchRepository.upsert({
        gameId: game.id,
        providerName: provider.name,
        remoteId: metadata.remoteId,
        matchScore: 100,
        isPrimary: true,
        matchedAt: options.now,
      });
    }

    return {
      game: updated,
      fetchedArtwork: { header: !!headerCached, cover: !!coverCached },
    };
  }

  private async enrichWithSteamGridDb(
    steamAppId: number,
    coverDownloaded = false,
    heroDownloaded = false,
  ): Promise<{ gridUrl: string | null; heroUrl: string | null; logoUrl: string | null }> {
    if (!steamGridDbHttpClient) return { gridUrl: null, heroUrl: null, logoUrl: null };
    const baseQuery: SteamGridDbImageQuery = {
      types: ['static'],
      nsfw: 'false',
      humor: 'false',
    };
    const [grids, heroes, logos] = await Promise.all([
      coverDownloaded
        ? Promise.resolve([])
        : steamGridDbHttpClient.getGridsBySteamAppId(steamAppId, {
            ...baseQuery,
            styles: ['alternate', 'blurred'],
          }),
      heroDownloaded
        ? Promise.resolve([])
        : steamGridDbHttpClient.getHeroesBySteamAppId(steamAppId, {
            ...baseQuery,
            styles: ['alternate', 'blurred'],
          }),
      steamGridDbHttpClient.getLogosBySteamAppId(steamAppId, {
        ...baseQuery,
        styles: ['official', 'white', 'black', 'transparent'],
      }),
    ]);
    const gridUrl = selectBestImage(grids)?.url ?? null;
    const heroUrl = selectBestImage(heroes)?.url ?? null;
    const logoUrl = selectBestImage(logos)?.url ?? null;
    if (gridUrl) await this.deps.artwork.downloadToCache(steamAppId, 'cover', gridUrl);
    if (heroUrl) await this.deps.artwork.downloadToCache(steamAppId, 'hero', heroUrl);
    if (logoUrl) await this.deps.artwork.downloadToCache(steamAppId, 'logo', logoUrl);
    return { gridUrl, heroUrl, logoUrl };
  }
}
export const metadataService = new MetadataService();
