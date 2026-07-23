import type { FastifyInstance } from 'fastify';
import { buildServer } from './http/server.js';
import { logger } from './logger/index.js';
import { config } from './config/index.js';
import { recoverStaleScanRuns } from './modules/scanner/scanner.recovery.js';
import { steamIndexService } from './modules/metadata/steam-index/steam-index.service.js';
import { metadataRefreshJob } from './modules/metadata/metadata-refresh.job.js';
import './shared/bigint.js';

let app: FastifyInstance | null = null;

async function bootstrap(): Promise<void> {
  await recoverStaleScanRuns();
  await steamIndexService.start();
  void metadataRefreshJob.start();
  app = await buildServer();
  await app.listen({ port: config.port, host: config.host });
  logger.info(`kr8bit listening on http://${config.host}:${config.port}`);
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'failed to start kr8bit');
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  steamIndexService.stop();
  if (app) {
    try {
      await app.close();
      logger.info('http server closed');
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'http server close error');
    }
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));