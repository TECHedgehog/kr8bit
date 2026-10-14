import type { FastifyRequest, FastifyReply } from 'fastify';
import { libraryService, sanitizeGamePatch } from '../../modules/library/library.service.js';
import type { GameRenameInput } from '../../modules/library/library.types.js';
import { MAX_RENAME_IDS } from '../../modules/library/library.types.js';
import { ValidationError } from '../../shared/errors.js';

function parseRenameInput(body: unknown): GameRenameInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('rename payload must be an object');
  const raw = body as Record<string, unknown>;
  if (!Array.isArray(raw.ids) || raw.ids.length < 1 || raw.ids.length > MAX_RENAME_IDS || raw.ids.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new ValidationError(`ids must contain between 1 and ${MAX_RENAME_IDS} non-empty strings`);
  }
  if (raw.format !== undefined && typeof raw.format !== 'string') throw new ValidationError('format must be a string');
  return { ids: raw.ids.map((id) => (id as string).trim()), ...(raw.format !== undefined ? { format: raw.format as string } : {}) };
}

function parseRenameFormat(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('rename preview payload must be an object');
  const format = (body as Record<string, unknown>).format;
  if (format !== undefined && typeof format !== 'string') throw new ValidationError('format must be a string');
  return format as string | undefined;
}

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
    const input = parseRenameInput(req.body);
    return libraryService.rename(input.ids, req.demoSessionScope, input.format);
  },

  async renamePreview(req: FastifyRequest, _reply: FastifyReply) {
    const format = parseRenameFormat(req.body);
    return { items: await libraryService.previewRename(req.demoSessionScope, format) };
  },
};
