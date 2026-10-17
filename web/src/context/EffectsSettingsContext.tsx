import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import type { EffectParamValue, EffectParams } from '../components/effects/effectSettings';
import { usePersistedSettings } from '../hooks/usePersistedSettings';

// ── Types ───────────────────────────────────────────────────────────

/** id of the active background effect (catalog entry id), null = off */
type EffectId = string | null;

/** Per-effect tweaked params, keyed by control key (see *.settings.ts). */
export type EffectParamsMap = Record<string, EffectParams>;

interface EffectsSettings {
  background: EffectId;
  params: EffectParamsMap;
}

interface EffectsSettingsContextValue extends EffectsSettings {
  /** Single-select: setting a background replaces the previous one. */
  setBackground: (id: EffectId) => void;
  /** Store one tweaked param for an effect (merged with the existing map). */
  setParam: (effectId: string, key: string, value: EffectParamValue) => void;
  /** Drop all tweaked params for an effect — component defaults return. */
  resetParams: (effectId: string) => void;
}

// ── Persistence (localStorage, same pattern as GlassTuneContext) ────

const STORAGE_KEY = 'kr8bit-effects';

const DEFAULT_SETTINGS: EffectsSettings = {
  background: null,
  params: {},
};

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

function isValidParamValue(value: unknown): value is EffectParamValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/** Accepts stored settings and sanitizes persisted params. */
function sanitizeSettings(value: unknown): EffectsSettings {
  const parsed = value && typeof value === 'object' ? value as Partial<EffectsSettings> : {};
  const params: EffectParamsMap = {};
  if (parsed.params && typeof parsed.params === 'object') {
    for (const [effectId, effectParams] of Object.entries(parsed.params)) {
      if (!isValidId(effectId) || !effectParams || typeof effectParams !== 'object') continue;
      const clean: EffectParams = {};
      for (const [key, paramValue] of Object.entries(effectParams as Record<string, unknown>)) {
        if (isValidId(key) && isValidParamValue(paramValue)) clean[key] = paramValue;
      }
      params[effectId] = clean;
    }
  }
  return {
    background: isValidId(parsed.background) ? parsed.background : null,
    params,
  };
}

// ── Context ─────────────────────────────────────────────────────────

const EffectsSettingsContext = createContext<EffectsSettingsContextValue | null>(null);

export function EffectsSettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [settings, setSettings] = usePersistedSettings(STORAGE_KEY, DEFAULT_SETTINGS, sanitizeSettings);

  const setBackground = useCallback((background: EffectId) => {
    setSettings((current) => current.background === background ? current : { ...current, background });
  }, [setSettings]);

  const setParam = useCallback((effectId: string, key: string, value: EffectParamValue) => {
    setSettings((current) => ({
      ...current,
      params: {
        ...current.params,
        [effectId]: { ...(current.params[effectId] ?? {}), [key]: value },
      },
    }));
  }, [setSettings]);

  const resetParams = useCallback((effectId: string) => {
    setSettings((current) => {
      if (!(effectId in current.params)) return current;
      const params = { ...current.params };
      delete params[effectId];
      return { ...current, params };
    });
  }, [setSettings]);

  const value = useMemo<EffectsSettingsContextValue>(
    () => ({ ...settings, setBackground, setParam, resetParams }),
    [settings, setBackground, setParam, resetParams],
  );

  return (
    <EffectsSettingsContext.Provider value={value}>
      {children}
    </EffectsSettingsContext.Provider>
  );
}

export function useEffectsSettings(): EffectsSettingsContextValue {
  const ctx = useContext(EffectsSettingsContext);
  if (!ctx) throw new Error('useEffectsSettings must be used within EffectsSettingsProvider');
  return ctx;
}
