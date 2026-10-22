import type { FastifyPluginAsync } from 'fastify';
import { createMaintenanceController } from '../controllers/maintenance.controller.js';
import type { MaintenanceService } from '../../modules/maintenance/maintenance.service.js';

export function createMaintenanceRoutes(service: MaintenanceService): FastifyPluginAsync {
  const controller = createMaintenanceController(service);
  return async (app) => {
    app.post('/api/maintenance/library/wipe', controller.wipeLibrary);
    app.post('/api/maintenance/repack/wipe', controller.wipeRepack);
    app.post('/api/maintenance/artwork-cache/clear', controller.clearArtworkCache);
    app.post('/api/maintenance/metadata/refresh', controller.startMetadataRefresh);
    app.get('/api/maintenance/metadata/status', controller.metadataRefreshStatus);
    app.post('/api/maintenance/artwork/recheck', controller.startArtworkRecheck);
    app.get('/api/maintenance/artwork/status', controller.artworkRecheckStatus);
  };
}
