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

  async rename(req: FastifyRequest, _reply: FastifyReply) {
    const body = req.body as { ids?: unknown; format?: unknown };
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
    return libraryService.rename(ids, req.demoSessionScope, typeof body?.format === 'string' ? body.format : undefined);
  },

  async renamePreview(req: FastifyRequest, _reply: FastifyReply) {
    const body = req.body as { format?: unknown };
    return { items: await libraryService.previewRename(req.demoSessionScope, typeof body?.format === 'string' ? body.format : undefined) };
  },
};
