import type { FastifyPluginAsync } from 'fastify';
import { metadataController } from '../controllers/metadata.controller.js';
import { artworkController } from '../controllers/artwork.controller.js';

export const metadataRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/games/:id/metadata/search', metadataController.search);
  app.post('/api/games/:id/metadata/assign', metadataController.assign);
  app.delete('/api/games/:id/metadata', metadataController.unlink);
  app.post('/api/games/:id/metadata/refresh', metadataController.refresh);
  app.get('/api/games/:id/artwork/:kind', artworkController.serve);
};