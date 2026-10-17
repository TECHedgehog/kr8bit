import { describe, expect, it, vi } from 'vitest';
import { createSettingsReader } from '../src/modules/settings/settings.reader.js';
import type {
  BooleanSettingSpec,
  DateSettingSpec,
  IntegerSettingSpec,
  StringSettingSpec,
} from '../src/modules/settings/settings.types.js';

function setup(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const repository = {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
      return { key, value };
    }),
  };
  return { reader: createSettingsReader(repository), repository, values };
}

const stringSpec = { key: 'text', kind: 'string', default: 'fallback', constraints: { maxLength: 10 } } satisfies StringSettingSpec;
const booleanSpec = { key: 'enabled', kind: 'boolean', default: false } satisfies BooleanSettingSpec;
const integerSpec = { key: 'interval', kind: 'integer', default: 24, constraints: { min: 1, max: 48 } } satisfies IntegerSettingSpec;
const dateSpec = { key: 'refreshedAt', kind: 'date', default: '' } satisfies DateSettingSpec;

describe('settings reader', () => {
  it('returns typed defaults when settings are missing', async () => {
    const { reader } = setup();

    await expect(reader.string(stringSpec)).resolves.toBe('fallback');
    await expect(reader.boolean(booleanSpec)).resolves.toBe(false);
    await expect(reader.integer(integerSpec)).resolves.toBe(24);
    await expect(reader.date(dateSpec)).resolves.toBeNull();
  });

  it('parses valid stored values by spec kind', async () => {
    const { reader } = setup({
      text: 'hello',
      enabled: 'true',
      interval: '48',
      refreshedAt: '2026-10-17T12:30:00.000Z',
    });

    await expect(reader.string(stringSpec)).resolves.toBe('hello');
    await expect(reader.boolean(booleanSpec)).resolves.toBe(true);
    await expect(reader.integer(integerSpec)).resolves.toBe(48);
    await expect(reader.date(dateSpec)).resolves.toEqual(new Date('2026-10-17T12:30:00.000Z'));
  });

  it('uses spec defaults for junk, invalid strings, and out-of-range integers', async () => {
    const validatedStringSpec = {
      key: 'format',
      kind: 'string',
      default: '',
      validate: (value) => { if (!value.startsWith('{')) throw new Error('invalid'); },
    } satisfies StringSettingSpec;
    const { reader } = setup({
      text: 'this value is too long',
      enabled: 'yes',
      interval: '49',
      refreshedAt: 'not-a-date',
      format: 'invalid',
    });

    await expect(reader.string(stringSpec)).resolves.toBe('fallback');
    await expect(reader.string(validatedStringSpec)).resolves.toBe('');
    await expect(reader.boolean(booleanSpec)).resolves.toBe(false);
    await expect(reader.integer(integerSpec)).resolves.toBe(24);
    await expect(reader.date(dateSpec)).resolves.toBeNull();
  });

  it('writes date values as ISO strings readable by same spec', async () => {
    const { reader, repository, values } = setup();
    const refreshedAt = new Date('2026-10-17T12:30:00.000Z');

    await reader.write(dateSpec, refreshedAt);

    expect(repository.set).toHaveBeenCalledWith('refreshedAt', refreshedAt.toISOString());
    await expect(reader.date(dateSpec)).resolves.toEqual(refreshedAt);
    expect(values.get('refreshedAt')).toBe(refreshedAt.toISOString());
  });
});
