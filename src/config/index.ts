import { z } from 'zod';
import { config as loadEnv } from 'dotenv';

loadEnv();

const schema = z.object({
  LIBRARY_ROOT: z.string().min(1),
  CACHE_DIR: z.string().min(1),
  DB_PATH: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = {
  libraryRoot: parsed.data.LIBRARY_ROOT,
  cacheDir: parsed.data.CACHE_DIR,
  dbPath: parsed.data.DB_PATH,
  port: parsed.data.PORT,
  host: parsed.data.HOST,
  logLevel: parsed.data.LOG_LEVEL,
  databaseUrl: `file:${parsed.data.DB_PATH}`,
} as const;

export type Config = typeof config;