import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js';
import { repackCatalogJob } from '../../modules/repack-catalog/repack-catalog.job.js';
import { repackCatalogService } from '../../modules/repack-catalog/repack-catalog.service.js';

function pageOptions(query: Record<string, unknown>) {
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 24);
  if (!Number.isInteger(offset) || offset < 0) throw new ValidationError('offset must be a non-negative integer');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ValidationError('limit must be between 1 and 100');
  return { offset, limit };
}

export const repackCatalogController = {
  async list(req: FastifyRequest, _reply: FastifyReply) {
    const query = (req.query ?? {}) as Record<string, unknown>;
    const { offset, limit } = pageOptions(query);
    const search = typeof query.q === 'string' ? query.q.trim() : undefined;
    return repackCatalogService.list({ offset, limit, query: search || undefined });
  },
  async settings(_req: FastifyRequest, _reply: FastifyReply) { return repackCatalogService.settings(); },
  async status(_req: FastifyRequest, _reply: FastifyReply) { return repackCatalogService.statusSnapshot(); },
  async detail(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const game = await repackCatalogService.getGame(id);
    if (!game) throw new NotFoundError('RepackGame', id);
    return game;
  },
  async review(req: FastifyRequest, _reply: FastifyReply) {
    const { offset, limit } = pageOptions((req.query ?? {}) as Record<string, unknown>);
    return repackCatalogService.review({ offset, limit });
  },
  async sync(req: FastifyRequest, _reply: FastifyReply) {
    if (repackCatalogJob.isRunning()) throw new ConflictError('repack catalog job already in progress');
    const body = req.body as { fullArchive?: boolean } | null;
    return repackCatalogJob.sync(body?.fullArchive === true);
  },
  async audit(_req: FastifyRequest, _reply: FastifyReply) {
    if (repackCatalogJob.isRunning()) throw new ConflictError('repack catalog job already in progress');
    return repackCatalogJob.audit();
  },
  async searchCandidates(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = req.body as { query?: string } | null;
    return { candidates: await repackCatalogService.searchCandidates(id, body?.query) };
  },
  async previewCandidate(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = req.body as { providerName?: string; remoteId?: string } | null;
    if (!body?.providerName || !body.remoteId) throw new ValidationError('providerName and remoteId are required');
    return repackCatalogService.previewCandidate(id, body.providerName, body.remoteId);
  },
  async resolveMatch(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = req.body as { action?: string; providerName?: string; remoteId?: string } | null;
    if (body?.action === 'reject') return repackCatalogService.rejectCandidate(id);
    if (body?.action !== 'accept' || !body.providerName || !body.remoteId) {
      throw new ValidationError('accept requires providerName and remoteId; or action=reject');
    }
    return repackCatalogService.acceptCandidate(id, body.providerName, body.remoteId);
  },
};
