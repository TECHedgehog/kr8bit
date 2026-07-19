import type { FastifyRequest, FastifyReply } from 'fastify';
import { metadataService } from '../../modules/metadata/metadata.service.js';
import { ValidationError } from '../../shared/errors.js';

export const metadataController = {
  async search(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = (req.body as { query?: string } | null) ?? {};
    const query = typeof body.query === 'string' ? body.query : '';
    return metadataService.searchForGame(id, query);
  },

  async assign(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = req.body as { remoteId?: string } | null;
    if (!body?.remoteId || typeof body.remoteId !== 'string') {
      throw new ValidationError('remoteId is required');
    }
    return metadataService.assign(id, body.remoteId);
  },

  async unlink(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return metadataService.unlink(id);
  },

  async refresh(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return metadataService.refresh(id);
  },
};