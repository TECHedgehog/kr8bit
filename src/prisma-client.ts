import { PrismaClient } from '@prisma/client';
import { logger } from './logger/index.js';
import { config } from './config/index.js';

const logConfig: Array<{ level: 'query' | 'warn' | 'error'; emit: 'event' }> = [
  { level: 'warn', emit: 'event' },
  { level: 'error', emit: 'event' },
];

if (config.logLevel === 'debug') {
  logConfig.push({ level: 'query', emit: 'event' });
}

export const prisma = new PrismaClient({
  log: logConfig,
});

prisma.$on('warn', (e) => logger.warn({ prisma: e.message }));
prisma.$on('error', (e) => logger.error({ prisma: e.message }));

if (config.logLevel === 'debug') {
  prisma.$on('query', (e) => {
    logger.debug({ prisma: { durationMs: e.duration, query: e.query, params: e.params } }, 'prisma query');
  });
}