import { describe, expect, it, vi } from 'vitest';

import { loadPersisted, savePersisted } from './usePersistedSettings';

describe('persisted settings', () => {
  const defaults = { enabled: false, count: 3 };

  it('returns defaults for corrupt JSON', () => {
    const storage = { getItem: vi.fn(() => '{'), setItem: vi.fn() };

    expect(loadPersisted('settings', defaults, (value) => value as typeof defaults, storage)).toEqual(defaults);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('sanitizes parsed settings', () => {
    const storage = { getItem: vi.fn(() => '{"enabled":true,"count":-1}'), setItem: vi.fn() };
    const sanitize = (value: unknown) => {
      const parsed = value as Partial<typeof defaults>;
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaults.enabled,
        count: typeof parsed.count === 'number' && parsed.count >= 0 ? parsed.count : defaults.count,
      };
    };

    expect(loadPersisted('settings', defaults, sanitize, storage)).toEqual({ enabled: true, count: 3 });
  });

  it('tolerates storage failures while loading and saving', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('read denied'); }),
      setItem: vi.fn(() => { throw new Error('write denied'); }),
    };

    expect(loadPersisted('settings', defaults, (value) => value as typeof defaults, storage)).toBe(defaults);
    expect(() => savePersisted('settings', defaults, storage)).not.toThrow();
  });

  it('serializes updated settings', () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() };

    savePersisted('settings', defaults, storage);

    expect(storage.setItem).toHaveBeenCalledWith('settings', JSON.stringify(defaults));
  });
});
