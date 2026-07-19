import type { FastifyPluginAsync } from 'fastify';
import { scannerController } from '../controllers/scanner.controller.js';

export const scannerRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/scanner/run', async (req, reply) => scannerController.run(req, reply));
  app.get('/api/scanner/status', scannerController.status);
  app.get('/api/scanner/progress', scannerController.progress);
};