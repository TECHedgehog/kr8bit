import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config/index.js';
import { version } from '../../app-version.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      version,
      libraryRoot: config.libraryRoot,
    };
  });
};