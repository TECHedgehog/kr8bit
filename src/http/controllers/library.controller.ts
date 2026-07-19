import type { FastifyRequest, FastifyReply } from 'fastify';
import { libraryService, sanitizeGamePatch } from '../../modules/library/library.service.js';

export const libraryController = {
  async list(req: FastifyRequest, _reply: FastifyReply) {
    const filter = libraryService.parseListFilter(req.query as Record<string, string | undefined>);
    const result = await libraryService.list(filter);
    return result;
  },

  async getById(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return libraryService.getById(id);
  },

  async update(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const patch = sanitizeGamePatch(req.body);
    return libraryService.update(id, patch);
  },

  async delete(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await libraryService.delete(id);
    return { deleted: true, id };
  },
};