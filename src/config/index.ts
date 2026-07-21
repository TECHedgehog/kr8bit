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
  IGDB_CLIENT_ID: z.string().optional(),
  IGDB_CLIENT_SECRET: z.string().optional(),
  IGDB_API_BASE: z.string().url().default('https://api.igdb.com/v4'),
  IGDB_TOKEN_BASE: z.string().url().default('https://id.twitch.tv/oauth2'),
  IGDB_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
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
  igdb: {
    clientId: parsed.data.IGDB_CLIENT_ID,
    clientSecret: parsed.data.IGDB_CLIENT_SECRET,
    apiBase: parsed.data.IGDB_API_BASE,
    tokenBase: parsed.data.IGDB_TOKEN_BASE,
    httpTimeoutMs: parsed.data.IGDB_HTTP_TIMEOUT_MS,
    enabled: Boolean(parsed.data.IGDB_CLIENT_ID && parsed.data.IGDB_CLIENT_SECRET),
  },
} as const;

export type Config = typeof config;