import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { GlassOptics } from '@samasante/liquid-glass';

export interface GlassPillState {
  effectiveOptics: Partial<GlassOptics>;
}

interface GlassTuneContextValue {
  pill: GlassPillState;
}

const STORAGE_KEY = 'kr8bit-glass-pill';
const PILL_DEFAULT: Partial<GlassOptics> = {
  curvature: 0.38,
  depth: 0.19,
  dispersion: 0,
  strength: 0,
  bend: 0.2,
  bendWidth: 0.2,
  sheen: 0.5,
  sheenWidth: 2,
  sheenAngle: 135,
  specular: 1.3,
  glow: 0.2,
  glowSpread: 0.5,
  glowFalloff: 1.5,
  frost: 0,
  brightness: 0.04,
  clipToShape: true,
  softEdge: true,
};

function loadStoredOptics(): Partial<GlassOptics> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { optics?: Partial<GlassOptics> };
    return parsed.optics && typeof parsed.optics === 'object' ? parsed.optics : {};
  } catch {
    return {};
  }
}

const GlassTuneContext = createContext<GlassTuneContextValue | null>(null);

export function GlassTuneProvider({ children }: { children: ReactNode }): JSX.Element {
  const [optics] = useState(loadStoredOptics);
  const value = useMemo(() => ({ pill: { effectiveOptics: { ...PILL_DEFAULT, ...optics } } }), [optics]);
  return <GlassTuneContext.Provider value={value}>{children}</GlassTuneContext.Provider>;
}

export function useGlassTune(): GlassTuneContextValue {
  const context = useContext(GlassTuneContext);
  if (!context) throw new Error('useGlassTune must be used within GlassTuneProvider');
  return context;
}
