import type { FastifyRequest, FastifyReply } from 'fastify';
import { metadataService } from '../../modules/metadata/metadata.service.js';
import { steamIndexService } from '../../modules/metadata/steam-index/steam-index.service.js';
import { ConflictError, ValidationError } from '../../shared/errors.js';

export const metadataController = {
  async search(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = (req.body as { query?: string; provider?: string } | null) ?? {};
    const query = typeof body.query === 'string' ? body.query : '';
    const provider =
      typeof body.provider === 'string' && body.provider.length > 0 ? body.provider : undefined;
    return metadataService.searchForGame(id, query, provider);
  },

  async assign(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = req.body as { remoteId?: string; provider?: string } | null;
    if (!body?.remoteId || typeof body.remoteId !== 'string') {
      throw new ValidationError('remoteId is required');
    }
    const provider =
      typeof body.provider === 'string' && body.provider.length > 0 ? body.provider : 'steam';
    return metadataService.assign(id, provider, body.remoteId);
  },

  async unlink(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return metadataService.unlink(id);
  },

  async refresh(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return metadataService.refresh(id);
  },

  async refreshIndex(_req: FastifyRequest, reply: FastifyReply) {
    if (steamIndexService.isRefreshing()) {
      throw new ConflictError('steam index refresh already in progress');
    }
    const result = await steamIndexService.refresh();
    if (!result.ok) {
      if (result.reason === 'in-progress') {
        throw new ConflictError('steam index refresh already in progress');
      }
      reply.status(502);
      return { ok: false, reason: result.reason };
    }
    return { ok: true, rows: result.rows, refreshedAt: result.refreshedAt };
  },

  async searchSteamIndex(req: FastifyRequest, _reply: FastifyReply) {
    const q = (req.query as { q?: string } | null)?.q ?? '';
    const query = q.trim();
    if (!query) return { results: [] };
    const results = await steamIndexService.searchByName(query);
    return { results };
  },
};