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
  STEAM_INDEX_REFRESH_INTERVAL_HOURS: z.coerce.number().int().positive().default(24),
  STEAM_APP_LIST_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  STEAM_API_KEY: z.string().optional(),
  STEAMGRIDDB_API_KEY: z.string().optional(),
  STEAMGRIDDB_API_BASE: z.string().url().default('https://www.steamgriddb.com/api/v2'),
  STEAMGRIDDB_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  ARTWORK_HTTP_HEADER_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  ARTWORK_HTTP_BODY_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  ARTWORK_CACHE_TTL_MS: z.coerce.number().int().positive().default(2_592_000_000),
  STEAM_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  SCAN_MAX_DEPTH: z.coerce.number().int().positive().default(1),
  SCAN_EXTENSIONS: z.string().min(1).default('.7z'),
  SCAN_INSTALLER_NAMES: z.string().min(1).default('setup.exe'),
  MATCH_ACCEPT_THRESHOLD: z.coerce.number().int().min(0).max(100).default(85),
  MATCH_FLAG_THRESHOLD: z.coerce.number().int().min(0).max(100).default(70),
  HTTP_RETRY_COUNT: z.coerce.number().int().min(0).max(10).default(3),
  HTTP_RETRY_BASE_MS: z.coerce.number().int().positive().default(1000),
  METADATA_REFRESH_DELAY_MS: z.coerce.number().int().positive().default(500),
  METADATA_RETRY_DELAY_MS: z.coerce.number().int().positive().default(500),
  METADATA_REFRESH_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),
  METADATA_RETRY_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),
  METADATA_REFRESH_MIN_AGE_MS: z.coerce.number().int().positive().default(604_800_000),
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
    steamIndex: {
    refreshIntervalHours: parsed.data.STEAM_INDEX_REFRESH_INTERVAL_HOURS,
    appListHttpTimeoutMs: parsed.data.STEAM_APP_LIST_HTTP_TIMEOUT_MS,
    apiKey: parsed.data.STEAM_API_KEY ?? null,
    enabled: Boolean(parsed.data.STEAM_API_KEY),
  },
  steamgriddb: {
    apiKey: parsed.data.STEAMGRIDDB_API_KEY ?? null,
    apiBase: parsed.data.STEAMGRIDDB_API_BASE,
    httpTimeoutMs: parsed.data.STEAMGRIDDB_HTTP_TIMEOUT_MS,
    enabled: Boolean(parsed.data.STEAMGRIDDB_API_KEY),
  },
  artwork: {
    headerTimeoutMs: parsed.data.ARTWORK_HTTP_HEADER_TIMEOUT_MS,
    bodyTimeoutMs: parsed.data.ARTWORK_HTTP_BODY_TIMEOUT_MS,
    cacheTtlMs: parsed.data.ARTWORK_CACHE_TTL_MS,
  },
  steam: {
    httpTimeoutMs: parsed.data.STEAM_HTTP_TIMEOUT_MS,
  },
  scan: {
    maxDepth: parsed.data.SCAN_MAX_DEPTH,
    extensions: parsed.data.SCAN_EXTENSIONS.split(',').map((s) => s.trim().toLowerCase()),
    installerNames: parsed.data.SCAN_INSTALLER_NAMES.split(',').map((s) => s.trim().toLowerCase()),
  },
  match: {
    acceptThreshold: parsed.data.MATCH_ACCEPT_THRESHOLD,
    flagThreshold: parsed.data.MATCH_FLAG_THRESHOLD,
  },
  httpRetry: {
    count: parsed.data.HTTP_RETRY_COUNT,
    baseDelayMs: parsed.data.HTTP_RETRY_BASE_MS,
  },
  metadata: {
    refreshDelayMs: parsed.data.METADATA_REFRESH_DELAY_MS,
    retryDelayMs: parsed.data.METADATA_RETRY_DELAY_MS,
    refreshConcurrency: parsed.data.METADATA_REFRESH_CONCURRENCY,
    retryConcurrency: parsed.data.METADATA_RETRY_CONCURRENCY,
    refreshMinAgeMs: parsed.data.METADATA_REFRESH_MIN_AGE_MS,
  },
} as const;

export type Config = typeof config;