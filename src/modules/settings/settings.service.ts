import { ValidationError } from '../../shared/errors.js';
import { settingsRepository } from './settings.repository.js';
import type { Setting } from './settings.types.js';
import { config } from '../../config/index.js';

export interface SettingsEnvSnapshot {
  libraryRoot: string;
  cacheDir: string;
  port: number;
  host: string;
  logLevel: string;
}

export function parseSettingsUpsert(body: unknown): { key: string; value: string }[] {
  if (body === null || typeof body !== 'object') {
    throw new ValidationError('settings payload must be a JSON object');
  }
  const raw = body as Record<string, unknown>;
  const entries: { key: string; value: string }[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') {
      throw new ValidationError(`invalid value for ${key}: expected string`);
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
    let count = 0;
    for (const entry of entries) {
      await settingsRepository.set(entry.key, entry.value);
      count += 1;
    }
    return count;
  },
};