import type { FastifyPluginAsync } from 'fastify';
import { diagnosticsController } from '../controllers/diagnostics.controller.js';

export const diagnosticsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/diagnostics/run', diagnosticsController.run);
  app.get('/api/diagnostics/status', diagnosticsController.status);
  app.get('/api/diagnostics/report', diagnosticsController.report);
};
