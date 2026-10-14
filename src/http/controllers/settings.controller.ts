import type { FastifyRequest, FastifyReply } from 'fastify';
import { settingsService } from '../../modules/settings/settings.service.js';
import { repackCatalogJob } from '../../modules/repack-catalog/repack-catalog.job.js';
import { repackCatalogService } from '../../modules/repack-catalog/repack-catalog.service.js';
import { config } from '../../config/index.js';

export const settingsController = {
  async list(_req: FastifyRequest, _reply: FastifyReply) {
    const result = await settingsService.list();
    return {
      env: result.env,
      kv: result.entries,
    };
  },

  async upsert(req: FastifyRequest, _reply: FastifyReply) {
    const entries = settingsService.parseSettingsUpsert(req.body);
    const before = await repackCatalogService.settings();
    const count = await settingsService.upsert(entries);
    if (!config.demoMode && entries.some((entry) => entry.key.startsWith('repackCatalog'))) {
      const after = await repackCatalogService.settings();
      if (!after.enabled) repackCatalogJob.stop();
      else {
        const shouldSync = (!before.enabled && after.enabled) || before.baseUrl !== after.baseUrl;
        await repackCatalogJob.start(shouldSync);
      }
    }
    return { updated: count };
  },
};
