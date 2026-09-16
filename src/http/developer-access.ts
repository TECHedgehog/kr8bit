import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/index.js';

export function developerToolsAvailable(): boolean {
  return config.developerTools.enabled;
}

export function hasDeveloperAccess(_request: FastifyRequest): boolean {
  return developerToolsAvailable();
}

export async function requireDeveloperAccess(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!hasDeveloperAccess(request)) {
    await reply.status(403).send({
      statusCode: 403,
      code: 'DEVELOPER_ACCESS_REQUIRED',
      error: 'ForbiddenError',
      message: 'developer access required',
    });
  }
}
