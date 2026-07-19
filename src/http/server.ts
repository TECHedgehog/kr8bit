import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../logger/index.js';
import { healthRoutes } from './routes/health.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { scannerRoutes } from './routes/scanner.routes.js';
import { libraryRoutes } from './routes/library.routes.js';
import { metadataRoutes } from './routes/metadata.routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findWebDist(): string | null {
  const candidates = [
    join(__dirname, '..', 'web', 'dist'),
    join(__dirname, '..', '..', 'web', 'dist'),
    join(process.cwd(), 'web', 'dist'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  await app.register(cors, { origin: true });

  app.setErrorHandler((err, _req, reply) => {
    const statusCode = err.statusCode ?? 500;
    const code = err.code ?? 'INTERNAL_ERROR';
    logger.error({ err, statusCode, code }, 'request error');
    reply.status(statusCode).send({
      statusCode,
      code,
      error: err.name,
      message: err.message,
    });
  });

  await app.register(healthRoutes);
  await app.register(settingsRoutes);
  await app.register(scannerRoutes);
  await app.register(libraryRoutes);
  await app.register(metadataRoutes);

  const webDist = findWebDist();
  if (webDist) {
    const { default: fastifyStatic } = await import('@fastify/static');
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
      wildcard: false,
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        reply.status(404).send({
          statusCode: 404,
          code: 'NOT_FOUND',
          error: 'NotFoundError',
          message: `route not found: ${req.method} ${req.url}`,
        });
        return;
      }
      if (req.method !== 'GET') {
        reply.status(404).send({
          statusCode: 404,
          code: 'NOT_FOUND',
          error: 'NotFoundError',
          message: `route not found: ${req.method} ${req.url}`,
        });
        return;
      }
      const indexPath = join(webDist, 'index.html');
      readFile(indexPath).then(
        (buf) => reply.type('text/html').send(buf),
        () =>
          reply
            .status(500)
            .send({
              statusCode: 500,
              code: 'WEB_DIST_MISSING',
              error: 'InternalError',
              message: 'web dist index.html missing',
            }),
      );
    });
    logger.info({ webDist }, 'serving web ui');
  } else {
    logger.info('web dist not present; api-only mode');
    app.setNotFoundHandler((req, reply) => {
      reply.status(404).send({
        statusCode: 404,
        code: 'NOT_FOUND',
        error: 'NotFoundError',
        message: `route not found: ${req.method} ${req.url}`,
      });
    });
  }

  return app;
}