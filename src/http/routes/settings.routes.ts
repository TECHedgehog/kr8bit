import type { FastifyPluginAsync } from 'fastify';
import { settingsController } from '../controllers/settings.controller.js';

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/settings', settingsController.list);
  app.put('/api/settings', settingsController.upsert);
};