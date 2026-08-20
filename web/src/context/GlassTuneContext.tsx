import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { GlassOptics } from '@samasante/liquid-glass';
import {
  ORB_DEFAULT,
  DEFAULT_ORB_GEOMETRY,
  type LensGeometry,
  type MovementPattern,
} from '../components/glass/GlassLens';

// ── Types ───────────────────────────────────────────────────────────

export type GeometryKey = 'width' | 'height' | 'radius';
export type OpticKey = keyof GlassOptics;

export interface SliderConfig<K extends string> {
  key: K;
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface OpticSection {
  title: string;
  sliders: SliderConfig<OpticKey>[];
}

// ── Pill defaults ───────────────────────────────────────────────────
// Tuned for a thin oblong pill, not a 220×220 round lens. ORB_DEFAULT's
// depth 0.85 / curvature 0.6 is a strong magnifying dome that distorts on
// a pill; these values keep a glassy rim + edge-light without a heavy body
// dome. Reference: SLIDER_BASE in GlassSlider.tsx (thin-control precedent).
//
// `strength` is the TRANSIT PEAK refraction: the lens has zero refraction
// at rest (plain frosted chip) and ramps 0 → strength → 0 while it raises,
// slides to the new active entry, and lowers back. The Strength slider
// therefore controls the magnification seen only during the move.
export const PILL_DEFAULT: Partial<GlassOptics> = {
  curvature: 0.4,
  depth: 0.5,
  dispersion: 0.4,
  strength: 0.5,
  bend: 0.12,
  bendWidth: 0.1,
  sheen: 0.5,
  sheenWidth: 2,
  sheenAngle: 135,
  specular: 1.3,
  glow: 0.2,
  glowSpread: 0.5,
  glowFalloff: 1.5,
  frost: 1.5,
  brightness: 0.04,
  clipToShape: true,
  softEdge: true,
};

export const DEFAULT_PILL_GEOMETRY: LensGeometry = {
  width: 80,
  height: 44,
  radius: 25,
};

// ── Slider configs ──────────────────────────────────────────────────
// Per-target geometry ranges: orb is a large round lens, pill is a thin
// oblong chip. Pill height min 16 lets the default 32px pill be tuned
// down; radius max 40 keeps the capsule ratio sensible at pill scale.
export const GEOMETRY_SLIDERS_BY_TARGET: Record<GlassTarget, SliderConfig<GeometryKey>[]> = {
  orb: [
    { key: 'width', label: 'Width', min: 80, max: 400, step: 1 },
    { key: 'height', label: 'Height', min: 80, max: 400, step: 1 },
    { key: 'radius', label: 'Radius', min: 0, max: 200, step: 1 },
  ],
  pill: [
    { key: 'height', label: 'Height', min: 16, max: 80, step: 1 },
    { key: 'radius', label: 'Radius', min: 0, max: 40, step: 1 },
  ],
};

export const OPTIC_SECTIONS: OpticSection[] = [
  {
    title: 'Refraction',
    sliders: [
      { key: 'strength', label: 'Strength', min: 0, max: 1, step: 0.01 },
      { key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01 },
      { key: 'curvature', label: 'Curvature', min: 0, max: 1, step: 0.01 },
      { key: 'dispersion', label: 'Dispersion', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Edge',
    sliders: [
      { key: 'bend', label: 'Bend', min: 0, max: 1, step: 0.01 },
      { key: 'bendWidth', label: 'Width', min: 0, max: 0.5, step: 0.01 },
    ],
  },
  {
    title: 'Sheen',
    sliders: [
      { key: 'sheen', label: 'Intensity', min: 0, max: 2, step: 0.01 },
      { key: 'sheenWidth', label: 'Thickness', min: 0, max: 10, step: 0.1 },
      { key: 'specular', label: 'Specular', min: 0, max: 3, step: 0.01 },
      { key: 'sheenAngle', label: 'Angle', min: 0, max: 360, step: 1 },
    ],
  },
  {
    title: 'Background',
    sliders: [
      { key: 'glow', label: 'Glow', min: 0, max: 2, step: 0.01 },
      { key: 'frost', label: 'Frost', min: 0, max: 10, step: 0.1 },
      { key: 'brightness', label: 'Brightness', min: -0.5, max: 0.5, step: 0.01 },
    ],
  },
];

// Optic sliders hidden for the pill target. Empty now — the pill's width is
// dynamic (driven by the active nav entry, no slider) and sheenAngle is back to
// a static value. This set is the forward shape for locking more pill sliders
// to defaults when that step comes.
export const PILL_HIDDEN_OPTICS: ReadonlySet<OpticKey> = new Set<OpticKey>();

// ── Helpers ─────────────────────────────────────────────────────────

export function formatValue(value: number, step: number): string {
  if (step >= 1) return String(Math.round(value));
  if (step >= 0.1) return value.toFixed(1);
  return value.toFixed(2);
}

function geometryEquals(a: LensGeometry, b: LensGeometry): boolean {
  return a.width === b.width && a.height === b.height && a.radius === b.radius;
}

// ── Context ─────────────────────────────────────────────────────────

export type GlassTarget = 'orb' | 'pill';

// Re-exported for consumers of the context; defined in GlassLens.tsx where the
// motion controller lives.
export type { MovementPattern };

interface TargetState {
  optics: Partial<GlassOptics>;
  geometry: LensGeometry;
  effectiveOptics: Partial<GlassOptics>;
}

interface GlassTuneContextValue {
  activeTarget: GlassTarget;
  setActiveTarget: (target: GlassTarget) => void;
  active: TargetState;
  orb: TargetState;
  pill: TargetState;
  updateOptic: (key: OpticKey, value: number) => void;
  updateGeometry: (key: GeometryKey, value: number) => void;
  resetActive: () => void;
  saveActive: () => void;
  isDirty: boolean;
  // Orb lens motion toggles. Playground-only — no other glass element reads
  // these. Persisted to localStorage so the test config survives reload.
  followCursor: boolean;
  independent: boolean;
  movementPattern: MovementPattern;
  setFollowCursor: (on: boolean) => void;
  setIndependent: (on: boolean) => void;
  setMovementPattern: (pattern: MovementPattern) => void;
}

const GlassTuneContext = createContext<GlassTuneContextValue | null>(null);

const PILL_STORAGE_KEY = 'kr8bit-glass-pill';

interface StoredPillConfig {
  optics: Partial<GlassOptics>;
  geometry: LensGeometry;
}

function loadStoredPill(): StoredPillConfig | null {
  try {
    const raw = localStorage.getItem(PILL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPillConfig;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.optics &&
      parsed.geometry &&
      typeof parsed.geometry.width === 'number' &&
      typeof parsed.geometry.height === 'number' &&
      typeof parsed.geometry.radius === 'number'
    ) {
      return parsed;
    }
  } catch {
    // ignore parse/storage errors
  }
  return null;
}

function saveStoredPill(config: StoredPillConfig): void {
  try {
    localStorage.setItem(PILL_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}

// ── Orb config persistence (explicit save) ────────────────────────
// Orb is save-on-demand (the Save button), unlike pill which auto-saves.
// Reset clears both the in-memory overrides and the stored snapshot.
const ORB_STORAGE_KEY = 'kr8bit-glass-orb';

interface StoredOrbConfig {
  optics: Partial<GlassOptics>;
  geometry: LensGeometry;
}

function loadStoredOrb(): StoredOrbConfig | null {
  try {
    const raw = localStorage.getItem(ORB_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredOrbConfig;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.optics &&
      parsed.geometry &&
      typeof parsed.geometry.width === 'number' &&
      typeof parsed.geometry.height === 'number' &&
      typeof parsed.geometry.radius === 'number'
    ) {
      return parsed;
    }
  } catch {
    // ignore parse/storage errors
  }
  return null;
}

function saveStoredOrb(config: StoredOrbConfig): void {
  try {
    localStorage.setItem(ORB_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}

function clearStoredOrb(): void {
  try {
    localStorage.removeItem(ORB_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

// ── Motion config persistence (orb lens auto-movement) ───────────
// Separate key from pill — motion is orb-only and toggles independently.
const MOTION_STORAGE_KEY = 'kr8bit-glass-motion';

interface StoredMotionConfig {
  followCursor: boolean;
  independent: boolean;
  movementPattern: MovementPattern;
}

const DEFAULT_MOTION: StoredMotionConfig = {
  followCursor: true,
  independent: false,
  movementPattern: 'lissajous',
};

function loadStoredMotion(): StoredMotionConfig {
  try {
    const raw = localStorage.getItem(MOTION_STORAGE_KEY);
    if (!raw) return DEFAULT_MOTION;
    const parsed = JSON.parse(raw) as Partial<StoredMotionConfig>;
    const validPatterns: MovementPattern[] = ['lissajous', 'linear', 'circular', 'random'];
    return {
      followCursor: typeof parsed.followCursor === 'boolean' ? parsed.followCursor : DEFAULT_MOTION.followCursor,
      independent: typeof parsed.independent === 'boolean' ? parsed.independent : DEFAULT_MOTION.independent,
      movementPattern:
        parsed.movementPattern && validPatterns.includes(parsed.movementPattern)
          ? parsed.movementPattern
          : DEFAULT_MOTION.movementPattern,
    };
  } catch {
    return DEFAULT_MOTION;
  }
}

function saveStoredMotion(config: StoredMotionConfig): void {
  try {
    localStorage.setItem(MOTION_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}

export function GlassTuneProvider({ children }: { children: ReactNode }): JSX.Element {
  const [activeTarget, setActiveTarget] = useState<GlassTarget>('orb');
  const storedOrb = useMemo(() => loadStoredOrb(), []);
  const [orbOptics, setOrbOptics] = useState<Partial<GlassOptics>>(storedOrb?.optics ?? {});
  const [orbGeometry, setOrbGeometry] = useState<LensGeometry>(storedOrb?.geometry ?? DEFAULT_ORB_GEOMETRY);
  const storedPill = useMemo(() => loadStoredPill(), []);
  const [pillOptics, setPillOptics] = useState<Partial<GlassOptics>>(storedPill?.optics ?? {});
  const [pillGeometry, setPillGeometry] = useState<LensGeometry>(storedPill?.geometry ?? DEFAULT_PILL_GEOMETRY);
  const storedMotion = useMemo(() => loadStoredMotion(), []);
  const [followCursor, setFollowCursor] = useState<boolean>(storedMotion.followCursor);
  const [independent, setIndependent] = useState<boolean>(storedMotion.independent);
  const [movementPattern, setMovementPattern] = useState<MovementPattern>(storedMotion.movementPattern);

  useEffect(() => {
    saveStoredPill({ optics: pillOptics, geometry: pillGeometry });
  }, [pillOptics, pillGeometry]);

  useEffect(() => {
    saveStoredMotion({ followCursor, independent, movementPattern });
  }, [followCursor, independent, movementPattern]);

  const updateOptic = useCallback(
    (key: OpticKey, value: number) => {
      if (activeTarget === 'orb') {
        setOrbOptics((prev) => ({ ...prev, [key]: value }));
      } else {
        setPillOptics((prev) => ({ ...prev, [key]: value }));
      }
    },
    [activeTarget],
  );

  const updateGeometry = useCallback(
    (key: GeometryKey, value: number) => {
      if (activeTarget === 'orb') {
        setOrbGeometry((prev) => ({ ...prev, [key]: value }));
      } else {
        setPillGeometry((prev) => ({ ...prev, [key]: value }));
      }
    },
    [activeTarget],
  );

  const resetActive = useCallback(() => {
    if (activeTarget === 'orb') {
      setOrbOptics({});
      setOrbGeometry(DEFAULT_ORB_GEOMETRY);
      clearStoredOrb();
    } else {
      setPillOptics({});
      setPillGeometry(DEFAULT_PILL_GEOMETRY);
    }
  }, [activeTarget]);

  // Orb is save-on-demand; pill auto-saves via its own effect, so this is
  // a no-op when pill is active (the Save button is hidden then anyway).
  const saveActive = useCallback(() => {
    if (activeTarget === 'orb') {
      saveStoredOrb({ optics: orbOptics, geometry: orbGeometry });
    }
  }, [activeTarget, orbOptics, orbGeometry]);

  const orbEffective = useMemo(
    () => ({ ...ORB_DEFAULT, ...orbOptics }),
    [orbOptics],
  );
  const pillEffective = useMemo(
    () => ({ ...PILL_DEFAULT, ...pillOptics }),
    [pillOptics],
  );

  const orb: TargetState = useMemo(
    () => ({
      optics: orbOptics,
      geometry: orbGeometry,
      effectiveOptics: orbEffective,
    }),
    [orbOptics, orbGeometry, orbEffective],
  );

  const active: TargetState = useMemo(
    () => activeTarget === 'orb'
      ? { optics: orbOptics, geometry: orbGeometry, effectiveOptics: orbEffective }
      : { optics: pillOptics, geometry: pillGeometry, effectiveOptics: pillEffective },
    [activeTarget, orbOptics, orbGeometry, orbEffective, pillOptics, pillGeometry, pillEffective],
  );

  const pill: TargetState = useMemo(
    () => ({
      optics: pillOptics,
      geometry: pillGeometry,
      effectiveOptics: pillEffective,
    }),
    [pillOptics, pillGeometry, pillEffective],
  );

  const isDirty = activeTarget === 'orb'
    ? Object.keys(orbOptics).length > 0 || !geometryEquals(orbGeometry, DEFAULT_ORB_GEOMETRY)
    : Object.keys(pillOptics).length > 0 || !geometryEquals(pillGeometry, DEFAULT_PILL_GEOMETRY);

  const value = useMemo<GlassTuneContextValue>(
    () => ({
      activeTarget,
      setActiveTarget,
      active,
      orb,
      pill,
      updateOptic,
      updateGeometry,
      resetActive,
      saveActive,
      isDirty,
      followCursor,
      independent,
      movementPattern,
      setFollowCursor,
      setIndependent,
      setMovementPattern,
    }),
    [
      activeTarget,
      active,
      orb,
      pill,
      updateOptic,
      updateGeometry,
      resetActive,
      saveActive,
      isDirty,
      followCursor,
      independent,
      movementPattern,
    ],
  );

  return (
    <GlassTuneContext.Provider value={value}>
      {children}
    </GlassTuneContext.Provider>
  );
}

export function useGlassTune(): GlassTuneContextValue {
  const ctx = useContext(GlassTuneContext);
  if (!ctx) throw new Error('useGlassTune must be used within GlassTuneProvider');
  return ctx;
}
