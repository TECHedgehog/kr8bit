import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export type PersistedSettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

function resolveStorage(storage?: PersistedSettingsStorage): PersistedSettingsStorage | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadPersisted<T>(
  key: string,
  defaults: T,
  sanitize: (value: unknown) => T,
  storage?: PersistedSettingsStorage,
): T {
  const target = resolveStorage(storage);
  if (!target) return defaults;

  try {
    const raw = target.getItem(key);
    return raw === null ? defaults : sanitize(JSON.parse(raw) as unknown);
  } catch {
    return defaults;
  }
}

export function savePersisted<T>(key: string, value: T, storage?: PersistedSettingsStorage): void {
  const target = resolveStorage(storage);
  if (!target) return;

  try {
    target.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore unavailable storage.
  }
}

export function usePersistedSettings<T>(
  key: string,
  defaults: T,
  sanitize: (value: unknown) => T,
  storage?: PersistedSettingsStorage,
): [T, Dispatch<SetStateAction<T>>] {
  const [settings, setSettings] = useState(() => loadPersisted(key, defaults, sanitize, storage));
  const initialSettings = useRef(settings);

  useEffect(() => {
    if (Object.is(settings, initialSettings.current)) return;
    savePersisted(key, settings, storage);
  }, [key, settings, storage]);

  return [settings, setSettings];
}
