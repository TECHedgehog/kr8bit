import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

function loadSettings(): PerformanceSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<PerformanceSettings>;
    return {
      motion: parsed.motion === 'reduced' || parsed.motion === 'full' ? parsed.motion : 'system',
      backgroundEffects: parsed.backgroundEffects !== false,
      gridAnimations: parsed.gridAnimations !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function PerformanceSettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const stored = useMemo(loadSettings, []);
  const [motion, setMotion] = useState<MotionPreference>(stored.motion);
  const [backgroundEffects, setBackgroundEffects] = useState(stored.backgroundEffects);
  const [gridAnimations, setGridAnimations] = useState(stored.gridAnimations);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ motion, backgroundEffects, gridAnimations }));
    } catch {
      // Ignore unavailable storage.
    }
  }, [motion, backgroundEffects, gridAnimations]);

  const value = useMemo<PerformanceSettingsContextValue>(() => ({
    motion,
    backgroundEffects,
    gridAnimations,
    setMotion,
    setBackgroundEffects,
    setGridAnimations,
    reset: () => {
      setMotion(DEFAULT_SETTINGS.motion);
      setBackgroundEffects(DEFAULT_SETTINGS.backgroundEffects);
      setGridAnimations(DEFAULT_SETTINGS.gridAnimations);
    },
  }), [motion, backgroundEffects, gridAnimations]);

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
