import type { FastifyInstance } from 'fastify';
import { buildServer } from './http/server.js';
import { logger } from './logger/index.js';
import { config } from './config/index.js';
import { prisma } from './prisma-client.js';
import { recoverStaleScanRuns } from './modules/scanner/scanner.recovery.js';
import { steamIndexService } from './modules/metadata/steam-index/steam-index.service.js';
import { metadataRefreshJob } from './modules/metadata/metadata-refresh.job.js';
import { retryMatchJob } from './modules/metadata/retry-match.job.js';
import { scannerService } from './modules/scanner/scanner.service.js';
import './shared/bigint.js';
import { demoService } from './modules/demo/demo-service.js';

let app: FastifyInstance | null = null;

async function bootstrap(): Promise<void> {
  if (config.demoMode) await demoService.resetAndSeed();
  else {
    await recoverStaleScanRuns();
    await steamIndexService.start();
    void metadataRefreshJob.start();
  }
  app = await buildServer();
  await app.listen({ port: config.port, host: config.host });
  logger.info(`kr8bit listening on http://${config.host}:${config.port}`);
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'failed to start kr8bit');
  process.exit(1);
});

const SHUTDOWN_DRAIN_TIMEOUT_MS = 10_000;
const SHUTDOWN_POLL_MS = 100;

function backgroundWorkRunning(): boolean {
  return (
    scannerService.isRunning() ||
    metadataRefreshJob.isRunning() ||
    retryMatchJob.isRunning()
  );
}

/** Wait (bounded) for scan/jobs to finish so a wipe mid-write never happens. */
async function drainBackgroundWork(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (backgroundWorkRunning()) {
    if (Date.now() >= deadline) {
      logger.warn({ timeoutMs }, 'shutdown drain timed out; proceeding with in-flight work');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, SHUTDOWN_POLL_MS));
  }
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  steamIndexService.stop();
  await drainBackgroundWork(SHUTDOWN_DRAIN_TIMEOUT_MS);
  if (app) {
    try {
      await app.close();
      logger.info('http server closed');
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'http server close error');
    }
  }
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'prisma disconnect error');
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
