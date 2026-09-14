import type { FastifyRequest, FastifyReply } from 'fastify';
import { libraryService, sanitizeGamePatch } from '../../modules/library/library.service.js';

export const libraryController = {
  async list(req: FastifyRequest, _reply: FastifyReply) {
    const filter = libraryService.parseListFilter(req.query as Record<string, string | undefined>);
    const result = await libraryService.list(filter, req.demoSessionScope);
    return result;
  },

  async genres(_req: FastifyRequest, _reply: FastifyReply) {
    const genres = await libraryService.listGenres(_req.demoSessionScope);
    return { genres };
  },

  async getById(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return libraryService.getById(id, req.demoSessionScope);
  },

  async update(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const patch = sanitizeGamePatch(req.body);
    return libraryService.update(id, patch, req.demoSessionScope);
  },

  async delete(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await libraryService.delete(id, req.demoSessionScope);
    return { deleted: true, id };
  },
};
