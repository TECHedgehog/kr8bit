import type { FastifyRequest, FastifyReply } from 'fastify';
import { libraryService } from '../../modules/library/library.service.js';
import { metadataService } from '../../modules/metadata/metadata.service.js';
import { STEAM_PROVIDER_NAME } from '../../modules/metadata/metadata.service.js';
import { ValidationError, NotFoundError } from '../../shared/errors.js';
import type { ArtworkKind } from '../../modules/artwork/artwork.service.js';
import type { Game } from '../../modules/library/library.types.js';

function remoteUrlFor(game: Game, kind: ArtworkKind): string | null | undefined {
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

export const artworkController = {
  async serve(req: FastifyRequest, reply: FastifyReply) {
    const { id, kind } = req.params as { id: string; kind: string };
    const kindValue = metadataService.artworkKind(kind);
    if (!kindValue) {
      throw new ValidationError(`invalid artwork kind: ${kind}`);
    }

    const game = await libraryService.getById(id);

    const primary = await metadataService.primaryProviderMatch(id);

    if (primary && primary.providerName !== STEAM_PROVIDER_NAME) {
      const remoteUrl = remoteUrlFor(game, kindValue);
      if (!remoteUrl) {
        throw new NotFoundError('Artwork', `${id}/${kind}`);
      }

      const cached = await metadataService
        .artwork()
        .readWithContentTypeGeneric(primary.providerName, primary.remoteId, kindValue);
      if (cached) {
        reply.header('Content-Type', cached.contentType);
        reply.header('Cache-Control', 'public, max-age=86400');
        return reply.send(cached.bytes);
      }

      reply.redirect(302, remoteUrl);
      return;
    }

    if (!game.steamAppId) {
      throw new NotFoundError('Artwork', `${id}/${kind}`);
    }

    const remoteUrl = remoteUrlFor(game, kindValue);
    if (!remoteUrl) {
      throw new NotFoundError('Artwork', `${id}/${kind}`);
    }

    const artwork = metadataService.artwork();
    const cached = await artwork.readWithContentType(game.steamAppId, kindValue);
    if (cached) {
      reply.header('Content-Type', cached.contentType);
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(cached.bytes);
    }

    reply.redirect(302, remoteUrl);
  },
};
