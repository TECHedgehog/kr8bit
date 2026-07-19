import type { FastifyRequest, FastifyReply } from 'fastify';
import { settingsService } from '../../modules/settings/settings.service.js';

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
    const count = await settingsService.upsert(entries);
    return { updated: count };
  },
};