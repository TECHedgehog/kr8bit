import type { FastifyPluginAsync } from 'fastify';
import { libraryController } from '../controllers/library.controller.js';

export const libraryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/games', libraryController.list);
  app.get('/api/games/:id', libraryController.getById);
  app.patch('/api/games/:id', libraryController.update);
  app.delete('/api/games/:id', libraryController.delete);
};