import { logger } from '../../logger/index.js';
import { MatchStatus } from '../../shared/enums.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { libraryRepository } from '../library/library.repository.js';
import type { Game } from '../library/library.types.js';
import type { MetadataProvider, SearchResult } from '../../shared/types.js';
import { providerMatchRepository } from '../metadata/provider-match.repository.js';
import type { ProviderRegistry } from '../metadata/provider-registry.js';
import { providerRegistry as defaultRegistry } from '../metadata/provider-registry.js';
import { artworkService, type ArtworkService, type ArtworkKind } from '../artwork/artwork.service.js';
import { normalizeGameName } from '../scanner/name-normalizer.js';

export const STEAM_PROVIDER_NAME = 'steam';

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

    const now = this.deps.now();
    const isSteam = provider.name === STEAM_PROVIDER_NAME;

    let headerCached: string | null = null;
    let coverCached: string | null = null;

    if (isSteam) {
      const appId = Number(metadata.remoteId);
      headerCached = await this.deps.artwork.downloadToCache(appId, 'header', metadata.headerUrl);
      coverCached = await this.deps.artwork.downloadToCache(appId, 'cover', metadata.coverUrl);
      logger.info(
        { gameId: game.id, remoteId, appId, headerCached, coverCached },
        'metadata assigned (steam)',
      );
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
      logger.info(
        { gameId: game.id, provider: provider.name, remoteId, headerCached, coverCached },
        'metadata assigned (generic)',
      );
    }

    const steamAppIdForUpdate = isSteam ? Number(metadata.remoteId) : null;

    const updated = await libraryRepository.update(game.id, {
      steamAppId: steamAppIdForUpdate,
      title: metadata.title,
      releaseYear: metadata.releaseYear ?? null,
      description: metadata.description ?? null,
      developers: metadata.developers,
      publishers: metadata.publishers,
      genres: metadata.genres,
      coverUrl: metadata.coverUrl ?? null,
      headerUrl: metadata.headerUrl ?? null,
      matchStatus: MatchStatus.MANUAL,
      matchScore: 100,
      matchedAt: now,
    });

    if (!isSteam) {
      await providerMatchRepository.upsert({
        gameId: game.id,
        providerName: provider.name,
        remoteId: metadata.remoteId,
        matchScore: 100,
        isPrimary: true,
        matchedAt: now,
      });
    }

    return {
      game: updated,
      fetchedArtwork: { header: !!headerCached, cover: !!coverCached },
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
      matchStatus: MatchStatus.PENDING,
      matchScore: null,
      matchedAt: null,
    });
  }

  artwork(): ArtworkService {
    return this.deps.artwork;
  }

  artworkKind(input: string): ArtworkKind | null {
    if (input === 'header' || input === 'cover') return input;
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

    const isSteam = provider.name === STEAM_PROVIDER_NAME;
    if (isSteam) {
      const appId = Number(metadata.remoteId);
      await this.deps.artwork.downloadToCache(appId, 'header', metadata.headerUrl);
      await this.deps.artwork.downloadToCache(appId, 'cover', metadata.coverUrl);
    } else {
      await this.deps.artwork.downloadToCacheGeneric(
        provider.name,
        metadata.remoteId,
        'header',
        metadata.headerUrl,
      );
      await this.deps.artwork.downloadToCacheGeneric(
        provider.name,
        metadata.remoteId,
        'cover',
        metadata.coverUrl,
      );
    }

    return libraryRepository.update(game.id, {
      title: metadata.title,
      releaseYear: metadata.releaseYear ?? null,
      description: metadata.description ?? null,
      developers: metadata.developers,
      publishers: metadata.publishers,
      genres: metadata.genres,
      coverUrl: metadata.coverUrl ?? null,
      headerUrl: metadata.headerUrl ?? null,
      matchedAt: this.deps.now(),
    });
  }

  private async refreshSteam(game: Game): Promise<Game | null> {
    if (!game.steamAppId) return null;
    const metadata = await this.deps.providers
      .resolve(STEAM_PROVIDER_NAME)!
      .getGame(String(game.steamAppId));
    if (!metadata) return null;

    await this.deps.artwork.downloadToCache(game.steamAppId, 'header', metadata.headerUrl);
    await this.deps.artwork.downloadToCache(game.steamAppId, 'cover', metadata.coverUrl);

    return libraryRepository.update(game.id, {
      title: metadata.title,
      releaseYear: metadata.releaseYear ?? null,
      description: metadata.description ?? null,
      developers: metadata.developers,
      publishers: metadata.publishers,
      genres: metadata.genres,
      coverUrl: metadata.coverUrl ?? null,
      headerUrl: metadata.headerUrl ?? null,
      matchedAt: this.deps.now(),
    });
  }
}

export const metadataService = new MetadataService();