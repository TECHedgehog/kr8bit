import type { FastifyReply, FastifyRequest } from 'fastify';
import { ValidationError } from '../../shared/errors.js';
import type { MaintenanceService } from '../../modules/maintenance/maintenance.service.js';

type ConfirmBody = { confirm?: unknown };

function requireConfirmation(request: FastifyRequest, expected: string): void {
  if ((request.body as ConfirmBody | undefined)?.confirm !== expected) {
    throw new ValidationError(`confirmation required: send { "confirm": "${expected}" }`);
  }
}

export function createMaintenanceController(service: MaintenanceService) {
  return {
    async wipeLibrary(request: FastifyRequest) {
      requireConfirmation(request, 'DELETE_LIBRARY');
      return service.wipeLibrary();
    },

    async wipeRepack(request: FastifyRequest) {
      requireConfirmation(request, 'DELETE_REPACK');
      return service.wipeRepack();
    },

    async clearArtworkCache(request: FastifyRequest) {
      requireConfirmation(request, 'CLEAR_ARTWORK_CACHE');
      return service.clearArtworkCache();
    },

    async startMetadataRefresh(_request: FastifyRequest, reply: FastifyReply) {
      reply.status(202);
      return service.startMetadataRefresh();
    },

    async metadataRefreshStatus() {
      return service.metadataRefreshStatus();
    },

    async startArtworkRecheck(_request: FastifyRequest, reply: FastifyReply) {
      reply.status(202);
      return service.startArtworkRecheck();
    },

    async artworkRecheckStatus() {
      return service.artworkRecheckStatus();
    },
  };
}
