import type { FastifyRequest, FastifyReply } from 'fastify';
import { metadataService } from '../../modules/metadata/metadata.service.js';
import { ValidationError } from '../../shared/errors.js';

const ARTWORK_CACHE_CONTROL = 'public, max-age=86400';

export const artworkController = {
  async serve(req: FastifyRequest, reply: FastifyReply) {
    const { id, kind } = req.params as { id: string; kind: string };
    const kindValue = metadataService.artworkKind(kind);
    if (!kindValue) {
      throw new ValidationError(`invalid artwork kind: ${kind}`);
    }

    const lookup = await metadataService.artworkFor(id, kindValue);
    if (lookup.kind === 'cached') {
      reply.header('Content-Type', lookup.contentType);
      reply.header('Cache-Control', ARTWORK_CACHE_CONTROL);
      return reply.send(lookup.bytes);
    }
    reply.redirect(302, lookup.url);
  },
};
