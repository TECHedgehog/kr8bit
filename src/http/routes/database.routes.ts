import type { FastifyPluginAsync } from 'fastify';
import { databaseController } from '../controllers/database.controller.js';
export const databaseRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/database/reset', async (req, reply) => databaseController.reset(req, reply));
  app.post('/api/database/cleanup', async (req, reply) => databaseController.cleanup(req, reply));
};
