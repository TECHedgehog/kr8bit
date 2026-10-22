import type { FastifyPluginAsync } from 'fastify';
import { databaseController } from '../controllers/database.controller.js';
import { ConflictError } from '../../shared/errors.js';

export function createDatabaseRoutes(repackCatalogJob: { isRunning(): boolean }): FastifyPluginAsync {
  return async (app) => {
    app.post('/api/database/reset', async (request, reply) => {
      if (repackCatalogJob.isRunning()) throw new ConflictError('repack catalog job already running');
      return databaseController.reset(request, reply);
    });
    app.post('/api/database/cleanup', databaseController.cleanup);
  };
}
