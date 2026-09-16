import type { FastifyPluginAsync } from 'fastify';
import { developerToolsAvailable, hasDeveloperAccess } from '../developer-access.js';

export const developerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/developer/status', async (request) => ({
    enabled: developerToolsAvailable(),
    unlocked: hasDeveloperAccess(request),
  }));

};
