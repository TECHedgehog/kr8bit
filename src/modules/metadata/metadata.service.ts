import { logger } from '../../logger/index.js';
import { MatchStatus } from '../../shared/enums.js';
import { NotFoundError } from '../../shared/errors.js';
import { libraryRepository } from '../library/library.repository.js';
import type { Game } from '../library/library.types.js';
import type { MetadataProvider, SearchResult } from '../../shared/types.js';
import { steamProvider } from '../metadata/steam/steam.provider.js';
import { artworkService, type ArtworkService, type ArtworkKind } from '../artwork/artwork.service.js';
import { normalizeGameName } from '../scanner/name-normalizer.js';

export interface MetadataDeps {
  provider: MetadataProvider;
  artwork: ArtworkService;
  now: () => Date;
}

export const defaultMetadataDeps: MetadataDeps = {
  provider: steamProvider,
  artwork: artworkService,
  now: () => new Date(),
};

export interface AssignedMetadata {
  game: Game;
  fetchedArtwork: { header: boolean; cover: boolean };
}

export interface ValidationResult {
  gameId: string;
  results: SearchResult[];
}

export class MetadataService {
  constructor(private readonly deps: MetadataDeps = defaultMetadataDeps) {}

  async searchForGame(gameId: string, query: string): Promise<ValidationResult> {
    const game = await libraryRepository.findById(gameId);
    if (!query.trim()) return { gameId: game.id, results: [] };
    const normalized = normalizeGameName(query).query;
    const results = normalized ? await this.deps.provider.search(normalized) : [];
    return { gameId: game.id, results };
  }

  async assign(gameId: string, remoteId: string): Promise<AssignedMetadata> {
    const game = await libraryRepository.findById(gameId);
    const metadata = await this.deps.provider.getGame(remoteId);
    if (!metadata) {
      throw new NotFoundError('RemoteGame', remoteId);
    }

    const appId = Number(metadata.remoteId);
    const headerCached = await this.deps.artwork.downloadToCache(appId, 'header', metadata.headerUrl);
    const coverCached = await this.deps.artwork.downloadToCache(appId, 'cover', metadata.coverUrl);

    logger.info(
      { gameId: game.id, remoteId, appId, headerCached, coverCached },
      'metadata assigned',
    );

    const updated = await libraryRepository.update(game.id, {
      steamAppId: appId,
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
      matchedAt: this.deps.now(),
    });

    return {
      game: updated,
      fetchedArtwork: { header: !!headerCached, cover: !!coverCached },
    };
  }

  async refresh(gameId: string): Promise<Game | null> {
    const game = await libraryRepository.findById(gameId);
    if (!game.steamAppId) return null;
    const metadata = await this.deps.provider.getGame(String(game.steamAppId));
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

  async unlink(gameId: string): Promise<Game> {
    const game = await libraryRepository.findById(gameId);
    if (game.steamAppId) {
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

  provider(): MetadataProvider {
    return this.deps.provider;
  }

  artwork(): ArtworkService {
    return this.deps.artwork;
  }

  artworkKind(input: string): ArtworkKind | null {
    if (input === 'header' || input === 'cover') return input;
    return null;
  }
}

export const metadataService = new MetadataService();