import type { FastifyPluginAsync } from 'fastify';
import type { RepackCatalogJob } from '../../modules/repack-catalog/repack-catalog.job.js';
import type { RepackCatalogService } from '../../modules/repack-catalog/repack-catalog.service.js';
import { createRepackCatalogController } from '../controllers/repack-catalog.controller.js';

export function createRepackCatalogRoutes(service: RepackCatalogService, job: RepackCatalogJob): FastifyPluginAsync {
  const controller = createRepackCatalogController(service, job);
  return async (app) => {
    app.get('/api/repack-catalog', controller.list);
    app.get('/api/repack-catalog/genres', controller.genres);
    app.get('/api/repack-catalog/settings', controller.settings);
    app.put('/api/repack-catalog/settings', controller.updateSettings);
    app.get('/api/repack-catalog/status', controller.status);
    app.get('/api/repack-catalog/review', controller.review);
    app.post('/api/repack-catalog/sync', controller.sync);
    app.post('/api/repack-catalog/audit', controller.audit);
    app.get('/api/repack-catalog/:id', controller.detail);
    app.get('/api/repack-catalog/:id/artwork/:kind', controller.artwork);
    app.post('/api/repack-catalog/:id/candidates/search', controller.searchCandidates);
    app.post('/api/repack-catalog/:id/candidates/preview', controller.previewCandidate);
    app.post('/api/repack-catalog/:id/match', controller.resolveMatch);
  };
}
