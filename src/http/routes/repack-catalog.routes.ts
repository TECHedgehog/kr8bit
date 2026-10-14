import type { FastifyPluginAsync } from 'fastify';
import { repackCatalogController } from '../controllers/repack-catalog.controller.js';

export const repackCatalogRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/repack-catalog', repackCatalogController.list);
  app.get('/api/repack-catalog/settings', repackCatalogController.settings);
  app.get('/api/repack-catalog/status', repackCatalogController.status);
  app.get('/api/repack-catalog/review', repackCatalogController.review);
  app.post('/api/repack-catalog/sync', repackCatalogController.sync);
  app.post('/api/repack-catalog/audit', repackCatalogController.audit);
  app.get('/api/repack-catalog/:id', repackCatalogController.detail);
  app.post('/api/repack-catalog/:id/candidates/search', repackCatalogController.searchCandidates);
  app.post('/api/repack-catalog/:id/candidates/preview', repackCatalogController.previewCandidate);
  app.post('/api/repack-catalog/:id/match', repackCatalogController.resolveMatch);
};
