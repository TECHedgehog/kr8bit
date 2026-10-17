import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { usePersistedSettings } from '../hooks/usePersistedSettings';

export type MotionPreference = 'system' | 'reduced' | 'full';

export interface PerformanceSettings {
  motion: MotionPreference;
  backgroundEffects: boolean;
  gridAnimations: boolean;
}

interface PerformanceSettingsContextValue extends PerformanceSettings {
  setMotion: (motion: MotionPreference) => void;
  setBackgroundEffects: (enabled: boolean) => void;
  setGridAnimations: (enabled: boolean) => void;
  reset: () => void;
}

const STORAGE_KEY = 'kr8bit-performance';
const DEFAULT_SETTINGS: PerformanceSettings = {
  motion: 'system',
  backgroundEffects: true,
  gridAnimations: true,
};

function sanitizeSettings(value: unknown): PerformanceSettings {
  const parsed = value && typeof value === 'object' ? value as Partial<PerformanceSettings> : {};
  return {
    motion: parsed.motion === 'reduced' || parsed.motion === 'full' ? parsed.motion : 'system',
    backgroundEffects: parsed.backgroundEffects !== false,
    gridAnimations: parsed.gridAnimations !== false,
  };
}

export function PerformanceSettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [settings, setSettings] = usePersistedSettings(STORAGE_KEY, DEFAULT_SETTINGS, sanitizeSettings);
  const setMotion = useCallback((motion: MotionPreference) => {
    setSettings((current) => current.motion === motion ? current : { ...current, motion });
  }, [setSettings]);
  const setBackgroundEffects = useCallback((backgroundEffects: boolean) => {
    setSettings((current) => current.backgroundEffects === backgroundEffects ? current : { ...current, backgroundEffects });
  }, [setSettings]);
  const setGridAnimations = useCallback((gridAnimations: boolean) => {
    setSettings((current) => current.gridAnimations === gridAnimations ? current : { ...current, gridAnimations });
  }, [setSettings]);
  const reset = useCallback(() => {
    setSettings((current) => current.motion === DEFAULT_SETTINGS.motion
      && current.backgroundEffects === DEFAULT_SETTINGS.backgroundEffects
      && current.gridAnimations === DEFAULT_SETTINGS.gridAnimations
      ? current
      : DEFAULT_SETTINGS);
  }, [setSettings]);

  const value = useMemo<PerformanceSettingsContextValue>(() => ({
    ...settings,
    setMotion,
    setBackgroundEffects,
    setGridAnimations,
    reset,
  }), [settings, setMotion, setBackgroundEffects, setGridAnimations, reset]);

  return <PerformanceSettingsContext.Provider value={value}>{children}</PerformanceSettingsContext.Provider>;
}

const PerformanceSettingsContext = createContext<PerformanceSettingsContextValue | null>(null);

export function usePerformanceSettings(): PerformanceSettingsContextValue {
  const context = useContext(PerformanceSettingsContext);
  if (!context) throw new Error('usePerformanceSettings must be used within PerformanceSettingsProvider');
  return context;
}

export function prefersReducedMotion(motion: MotionPreference): boolean {
  return motion === 'reduced' || (motion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
