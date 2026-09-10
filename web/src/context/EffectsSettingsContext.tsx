import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { EffectParamValue, EffectParams } from '../components/effects/effectSettings';
import { applyThemeEffectParams } from '../components/effects/themeEffectColors';
import { useTheme } from './ThemeContext';

// ── Types ───────────────────────────────────────────────────────────

/** id of the active background effect (catalog entry id), null = off */
export type EffectId = string | null;

/** Per-effect tweaked params, keyed by control key (see *.settings.ts). */
export type EffectParamsMap = Record<string, EffectParams>;

export interface EffectsSettings {
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

/** Accepts stored settings and migrates persisted params. */
function loadStoredSettings(): EffectsSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<EffectsSettings>;
    const params: EffectParamsMap = {};
    if (parsed.params && typeof parsed.params === 'object') {
      for (const [effectId, effectParams] of Object.entries(parsed.params)) {
        if (!isValidId(effectId) || !effectParams || typeof effectParams !== 'object') continue;
        const clean: EffectParams = {};
        for (const [key, value] of Object.entries(effectParams as Record<string, unknown>)) {
          if (isValidId(key) && isValidParamValue(value)) clean[key] = value;
        }
        params[effectId] = clean;
      }
    }
    return {
      background: isValidId(parsed.background) ? parsed.background : null,
      params,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveStoredSettings(settings: EffectsSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

// ── Context ─────────────────────────────────────────────────────────

const EffectsSettingsContext = createContext<EffectsSettingsContextValue | null>(null);

export function EffectsSettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const { theme } = useTheme();
  const stored = useMemo(() => loadStoredSettings(), []);
  const [background, setBackgroundId] = useState<EffectId>(stored.background);
  const [params, setParams] = useState<EffectParamsMap>(() => applyThemeEffectParams(theme, stored.params));

  useEffect(() => {
    setParams((prev) => applyThemeEffectParams(theme, prev));
  }, [theme]);

  useEffect(() => {
    saveStoredSettings({ background, params });
  }, [background, params]);

  const setBackground = useCallback((id: EffectId) => setBackgroundId(id), []);

  const setParam = useCallback((effectId: string, key: string, value: EffectParamValue) => {
    setParams((prev) => ({
      ...prev,
      [effectId]: { ...(prev[effectId] ?? {}), [key]: value },
    }));
  }, []);

  const resetParams = useCallback((effectId: string) => {
    setParams((prev) => {
      if (!(effectId in prev)) return prev;
      const next = { ...prev };
      delete next[effectId];
      return next;
    });
  }, []);

  const value = useMemo<EffectsSettingsContextValue>(
    () => ({ background, params, setBackground, setParam, resetParams }),
    [background, params, setBackground, setParam, resetParams],
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
