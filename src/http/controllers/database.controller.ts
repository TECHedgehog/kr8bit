import type { FastifyRequest, FastifyReply } from 'fastify';
import { databaseService } from '../../modules/database/database.service.js';
import { libraryService } from '../../modules/library/library.service.js';
import { ValidationError } from '../../shared/errors.js';
export const databaseController = {
  async reset(req: FastifyRequest, reply: FastifyReply) {
    if ((req.body as any)?.confirm !== 'RESET') {
      throw new ValidationError('confirmation required: send { "confirm": "RESET" }');
    }
    const result = await databaseService.reset();
    reply.status(200);
    return result;
  },

  async cleanup(_req: FastifyRequest, _reply: FastifyReply) {
    return libraryService.cleanOrphans();
  },
};
