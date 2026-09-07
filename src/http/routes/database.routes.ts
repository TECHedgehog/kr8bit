import type { FastifyPluginAsync } from 'fastify';
import { databaseController } from '../controllers/database.controller.js';
export const databaseRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/database/reset', databaseController.reset);
  app.post('/api/database/cleanup', databaseController.cleanup);
};
