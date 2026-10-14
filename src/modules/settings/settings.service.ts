import { ValidationError } from '../../shared/errors.js';
import { settingsRepository } from './settings.repository.js';
import type { Setting } from './settings.types.js';
import { config } from '../../config/index.js';
import { CUSTOM_FORMAT_SETTING, validateFilenameFormat } from '../../shared/filename-format.js';

export interface SettingsEnvSnapshot {
  libraryRoot: string;
  cacheDir: string;
  port: number;
  host: string;
  logLevel: string;
}

// Keys the app writes itself (not user configuration). Rejecting them via
// PUT /api/settings stops clients from corrupting internal bookkeeping —
// e.g. setting steamIndexLastRefresh far in the future would suppress
// Steam index refreshes indefinitely.
const RESERVED_KEYS = new Set(['steamIndexLastRefresh', 'repackCatalogFullImportComplete']);
const REPACK_BOOLEAN_SETTINGS = new Set(['repackCatalogEnabled', 'repackCatalogAuditEnabled']);
const REPACK_INTERVAL_SETTINGS = new Set(['repackCatalogIntervalHours', 'repackCatalogAuditIntervalHours']);
const REPACK_SETTINGS = new Set([
  ...REPACK_BOOLEAN_SETTINGS,
  ...REPACK_INTERVAL_SETTINGS,
  'repackCatalogFitGirlBaseUrl',
]);

const MAX_KEY_LENGTH = 100;
const MAX_VALUE_LENGTH = 10_000;

export function parseSettingsUpsert(body: unknown): { key: string; value: string }[] {
  if (body === null || typeof body !== 'object') {
    throw new ValidationError('settings payload must be a JSON object');
  }
  const raw = body as Record<string, unknown>;
  const entries: { key: string; value: string }[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (RESERVED_KEYS.has(key)) {
      throw new ValidationError(`key is internal and cannot be set: ${key}`);
    }
    if (key.length > MAX_KEY_LENGTH) {
      throw new ValidationError(`key too long (max ${MAX_KEY_LENGTH}): ${key}`);
    }
    if (typeof value !== 'string') {
      throw new ValidationError(`invalid value for ${key}: expected string`);
    }
    if (key.startsWith('repackCatalog') && !RESERVED_KEYS.has(key) && !REPACK_SETTINGS.has(key)) {
      throw new ValidationError(`unknown repack catalog setting: ${key}`);
    }
    if (REPACK_BOOLEAN_SETTINGS.has(key) && value !== 'true' && value !== 'false') {
      throw new ValidationError(`${key} must be true or false`);
    }
    if (REPACK_INTERVAL_SETTINGS.has(key)) {
      const hours = Number(value);
      if (!Number.isInteger(hours) || hours < 1 || hours > 8760) {
        throw new ValidationError(`${key} must be an integer from 1 to 8760`);
      }
    }
    if (key === 'repackCatalogFitGirlBaseUrl') {
      try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || !url.hostname) throw new Error('invalid source URL');
      } catch {
        throw new ValidationError('repackCatalogFitGirlBaseUrl must be an HTTPS URL');
      }
    }
    if (key === CUSTOM_FORMAT_SETTING && value.trim()) {
      try {
        validateFilenameFormat(value);
      } catch (err) {
        throw new ValidationError((err as Error).message);
      }
    }
    if (value.length > MAX_VALUE_LENGTH) {
      throw new ValidationError(`value too long (max ${MAX_VALUE_LENGTH}) for ${key}`);
    }
    entries.push({ key, value });
  }
  return entries;
}

export const settingsService = {
  parseSettingsUpsert,

  async list(): Promise<{ entries: Setting[]; env: SettingsEnvSnapshot }> {
    const entries = await settingsRepository.list();
    return {
      entries,
      env: {
        libraryRoot: config.libraryRoot,
        cacheDir: config.cacheDir,
        port: config.port,
        host: config.host,
        logLevel: config.logLevel,
      },
    };
  },

  async upsert(entries: { key: string; value: string }[]): Promise<number> {
    if (entries.length === 0) return 0;
    // Single transaction: a failure mid-batch must not leave a partially
    // applied settings update.
    return settingsRepository.setMany(entries);
  },
};
