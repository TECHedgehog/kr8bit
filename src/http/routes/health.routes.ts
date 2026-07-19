import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config/index.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      version: '0.1.0',
      libraryRoot: config.libraryRoot,
    };
  });
};