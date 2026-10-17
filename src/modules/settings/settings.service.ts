import { ValidationError } from '../../shared/errors.js';
import { settingsRepository } from './settings.repository.js';
import type { Setting, SettingSpec } from './settings.types.js';
import { config } from '../../config/index.js';
import { CUSTOM_FORMAT_SETTING_SPEC } from '../library/filename-format.js';
import { LIBRARY_MANUALLY_CLEARED_SETTING_SPEC } from '../library/library.settings.js';
import {
  SETTING_LAST_REFRESH,
  STEAM_INDEX_LAST_REFRESH_SETTING_SPEC,
} from '../metadata/steam-index/steam-index.service.js';
import { REPACK_CATALOG_SETTING_SPECS } from '../repack-catalog/repack-catalog.settings.js';

export interface SettingsEnvSnapshot {
  libraryRoot: string;
  cacheDir: string;
  port: number;
  host: string;
  logLevel: string;
}

const SETTING_SPECS: readonly SettingSpec[] = [
  ...REPACK_CATALOG_SETTING_SPECS,
  { ...CUSTOM_FORMAT_SETTING_SPEC, internal: true },
  LIBRARY_MANUALLY_CLEARED_SETTING_SPEC,
  { ...STEAM_INDEX_LAST_REFRESH_SETTING_SPEC, key: SETTING_LAST_REFRESH },
];
const RESERVED_KEYS = new Set(SETTING_SPECS.filter((spec) => spec.internal).map((spec) => spec.key));
const RESERVED_PREFIXES = new Set(SETTING_SPECS.flatMap((spec) => spec.prefix ? [spec.prefix] : []));
const SPECS_BY_KEY = new Map(SETTING_SPECS.map((spec) => [spec.key, spec]));

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
    if ([...RESERVED_PREFIXES].some((prefix) => key.startsWith(prefix))) {
      throw new ValidationError(`setting must use its domain endpoint: ${key}`);
    }
    if (value.length > MAX_VALUE_LENGTH) {
      throw new ValidationError(`value too long (max ${MAX_VALUE_LENGTH}) for ${key}`);
    }
    const entry = { key, value };
    const spec = SPECS_BY_KEY.get(key);
    if (spec) validateSettingEntries([entry], [spec]);
    entries.push(entry);
  }
  return entries;
}

export function validateSettingEntries(
  entries: { key: string; value: string }[],
  specs: readonly SettingSpec[],
): void {
  const specsByKey = new Map(specs.map((spec) => [spec.key, spec]));
  for (const { key, value } of entries) {
    const spec = specsByKey.get(key);
    if (!spec || spec.internal) throw new ValidationError(`setting is not user-configurable: ${key}`);
    if (value.length > (spec.constraints?.maxLength ?? MAX_VALUE_LENGTH)) {
      throw new ValidationError(`value too long (max ${spec.constraints?.maxLength ?? MAX_VALUE_LENGTH}) for ${key}`);
    }
    if (spec.kind === 'boolean' && value !== 'true' && value !== 'false') {
      throw new ValidationError(`${key} must be true or false`);
    }
    if (spec.kind === 'integer') {
      const parsed = Number(value);
      const min = spec.constraints?.min;
      const max = spec.constraints?.max;
      if (!Number.isInteger(parsed) || (min !== undefined && parsed < min) || (max !== undefined && parsed > max)) {
        throw new ValidationError(`${key} must be an integer from ${min ?? '-∞'} to ${max ?? '∞'}`);
      }
    }
    if (spec.constraints?.protocol) {
      try {
        const url = new URL(value);
        if (url.protocol !== spec.constraints.protocol || !url.hostname) throw new Error('invalid URL');
      } catch {
        throw new ValidationError(`${key} must be an ${spec.constraints.protocol.slice(0, -1).toUpperCase()} URL`);
      }
    }
    if (value && spec.validate) {
      try {
        spec.validate(value);
      } catch (error) {
        throw new ValidationError((error as Error).message);
      }
    }
  }
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
