import type { FastifyPluginAsync } from 'fastify';
import { metadataController } from '../controllers/metadata.controller.js';
import { artworkController } from '../controllers/artwork.controller.js';

export const metadataRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/games/:id/metadata/search', metadataController.search);
  app.post('/api/games/:id/metadata/assign', metadataController.assign);
  app.delete('/api/games/:id/metadata', metadataController.unlink);
  app.post('/api/games/:id/metadata/refresh', metadataController.refresh);
  app.get('/api/games/:id/artwork/:kind', artworkController.serve);

  app.post('/api/metadata/refresh-all', metadataController.refreshAll);
  app.get('/api/metadata/refresh-all/status', metadataController.refreshAllStatus);

  app.post('/api/metadata/index/refresh', metadataController.refreshIndex);
  app.get('/api/metadata/search-steam', metadataController.searchSteamIndex);
};