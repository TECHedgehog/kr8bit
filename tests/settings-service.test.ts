import { describe, it, expect, vi, beforeEach } from 'vitest';
import { config } from '../src/config/index.js';
import { settingsRepository } from '../src/modules/settings/settings.repository.js';
import { settingsService, parseSettingsUpsert } from '../src/modules/settings/settings.service.js';
import { ValidationError } from '../src/shared/errors.js';

vi.mock('../src/modules/settings/settings.repository.js', () => ({
  settingsRepository: {
    list: vi.fn(),
    set: vi.fn(),
    setMany: vi.fn(),
  },
}));

describe('parseSettingsUpsert', () => {
  it('returns entries for valid object', () => {
    expect(parseSettingsUpsert({ foo: 'bar', baz: 'qux' })).toEqual([
      { key: 'foo', value: 'bar' },
      { key: 'baz', value: 'qux' },
    ]);
  });

  it('throws for null', () => {
    expect(() => parseSettingsUpsert(null)).toThrow(ValidationError);
  });

  it('throws for non-object', () => {
    expect(() => parseSettingsUpsert('foo')).toThrow(ValidationError);
    expect(() => parseSettingsUpsert(123)).toThrow(ValidationError);
  });

  it('throws for non-string value', () => {
    expect(() => parseSettingsUpsert({ foo: 1 })).toThrow(ValidationError);
  });

  it('returns empty array for empty object', () => {
    expect(parseSettingsUpsert({})).toEqual([]);
  });

  it('returns multiple entries', () => {
    expect(parseSettingsUpsert({ a: '1', b: '2', c: '3' })).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
      { key: 'c', value: '3' },
    ]);
  });

  it('rejects internal keys', () => {
    expect(() => parseSettingsUpsert({ steamIndexLastRefresh: '2030-01-01' })).toThrow(ValidationError);
  });

  it('rejects oversized keys and values', () => {
    expect(() => parseSettingsUpsert({ ['k'.repeat(101)]: 'v' })).toThrow(ValidationError);
    expect(() => parseSettingsUpsert({ k: 'v'.repeat(10_001) })).toThrow(ValidationError);
  });
});

describe('settingsService.list', () => {
  it('returns entries and env snapshot', async () => {
    const entries = [{ key: 'foo', value: 'bar' }];
    vi.mocked(settingsRepository.list).mockResolvedValue(entries);

    const result = await settingsService.list();

    expect(result.entries).toBe(entries);
    expect(result.env).toEqual({
      libraryRoot: config.libraryRoot,
      cacheDir: config.cacheDir,
      port: config.port,
      host: config.host,
      logLevel: config.logLevel,
    });
  });
});

describe('settingsService.upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes all entries in one transaction and returns count', async () => {
    vi.mocked(settingsRepository.setMany).mockResolvedValue(2);

    const count = await settingsService.upsert([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);

    expect(settingsRepository.setMany).toHaveBeenCalledTimes(1);
    expect(settingsRepository.setMany).toHaveBeenCalledWith([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
    expect(count).toBe(2);
  });

  it('returns 0 for empty entries without touching the repository', async () => {
    const count = await settingsService.upsert([]);
    expect(count).toBe(0);
    expect(settingsRepository.setMany).not.toHaveBeenCalled();
  });
});
