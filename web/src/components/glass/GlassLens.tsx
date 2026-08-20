import { useEffect, useLayoutEffect, useRef, useMemo, type ReactNode } from 'react';
import {
  Glass,
  glassValue,
  type GlassOptics,
} from '@samasante/liquid-glass';

/**
 * A pointer-following glass lens that refracts its children in-place.
 *
 * The lens is a fixed-size window that tracks the pointer across the content.
 * In Chrome/Edge the live DOM bends through the lens (text stays selectable);
 * in Safari/Firefox the lens frosts + tints + edge-lights the content beneath.
 *
 * Motion values (`glassValue`) are updated imperatively in the pointer handler —
 * no React state in the hot path, so the lens follows at 60fps without
 * re-rendering.
 *
 * Playground motion toggles (opt-in, persisted via GlassTuneContext):
 * - `followCursor=false` → lens ignores the pointer.
 * - `independent=true` → a rAF loop traverses the box on its own. When both
 *   are on, pointer-enter eases the lens to the cursor and pauses the auto
 *   cycle; pointer-leave eases back to the paused cycle position and resumes.
 *   No teleporting — all transitions are eased.
 */

export const ORB_DEFAULT: Partial<GlassOptics> = {
  // A visible magnifying dome in the centre — the "liquid" middle.
  curvature: 0.6,
  // Refraction reaches well inward so the dome reads.
  depth: 0.85,
  // Moderate chromatic split at the rim.
  dispersion: 0.4,
  // Max pixel displacement as a fraction of the lens box.
  strength: 0.28,
  // The "liquid" lip — extra inward bend at the contour.
  bend: 0.15,
  bendWidth: 0.16,
  // A directional edge highlight pooling toward top-left.
  sheen: 0.5,
  sheenWidth: 2,
  sheenAngle: 135,
  specular: 1.3,
  // Soft inner glow.
  glow: 0.2,
  glowSpread: 0.5,
  glowFalloff: 1.5,
  // Light frost so the lens reads as glass even without the bend.
  frost: 1,
  brightness: 0.04,
  clipToShape: true,
  softEdge: true,
};

export interface LensGeometry {
  width: number;
  height: number;
  radius: number;
}

export const DEFAULT_ORB_GEOMETRY: LensGeometry = {
  width: 220,
  height: 220,
  radius: 110,
};

// ── Independent movement patterns ──────────────────────────────────
// Pure functions of elapsed time t (seconds) → {x, y} in 0..1 space.
// `random` is stateful (picks a new target every few seconds) so it is
// handled inline in the rAF loop, not in this table.
export type MovementPattern = 'lissajous' | 'linear' | 'circular' | 'random';

const TWO_PI = Math.PI * 2;

// Triangle wave in 0..1 for back-and-forth sweeps.
function tri(phase: number): number {
  const f = phase - Math.floor(phase);
  return f < 0.5 ? f * 2 : (1 - f) * 2;
}

const AUTO_PATTERNS: Record<Exclude<MovementPattern, 'random'>, (t: number) => { x: number; y: number }> = {
  // Different x/y frequencies → organic figure-8-ish path covering the box.
  lissajous: (t) => ({
    x: 0.5 + 0.4 * Math.sin(TWO_PI * 0.15 * t),
    y: 0.5 + 0.4 * Math.sin(TWO_PI * 0.1 * t + Math.PI / 2),
  }),
  // Back-and-forth across X, slowly drifting Y.
  linear: (t) => ({
    x: 0.5 + 0.45 * (tri(0.12 * t) * 2 - 1),
    y: 0.5 + 0.4 * (tri(0.05 * t) * 2 - 1),
  }),
  // Steady orbit around the centre.
  circular: (t) => ({
    x: 0.5 + 0.4 * Math.cos(TWO_PI * 0.1 * t),
    y: 0.5 + 0.4 * Math.sin(TWO_PI * 0.1 * t),
  }),
};

// Seconds the random walk holds each target before picking the next.
const RANDOM_HOLD = 2.5;
// Per-frame ease factor at 60fps — "moves quickly" without snapping.
const EASE_RATE = 0.3;
// Extra px the lens centre keeps inside the container edge so the lens
// is always fully rendered (the container has overflow: hidden).
const LENS_INSET_PX = 8;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export interface GlassLensProps {
  children: ReactNode;
  /** Lens width in px. @default 220 */
  width?: number;
  /** Lens height in px. @default 220 */
  height?: number;
  /** Corner radius in px. @default 110 */
  radius?: number;
  /** Optic overrides merged onto the orb default. */
  optics?: Partial<GlassOptics>;
  /** Class on the tracking container. */
  className?: string;
  /** Follow the pointer across the content. @default true */
  followCursor?: boolean;
  /** Auto-traverse the box on a rAF loop. @default false */
  independent?: boolean;
  /** Shape of the auto-traversal. @default 'lissajous' */
  movementPattern?: MovementPattern;
}

export function GlassLens({
  children,
  width = DEFAULT_ORB_GEOMETRY.width,
  height = DEFAULT_ORB_GEOMETRY.height,
  radius = DEFAULT_ORB_GEOMETRY.radius,
  optics,
  className,
  followCursor = true,
  independent = false,
  movementPattern = 'lissajous',
}: GlassLensProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  // Created once — the pointer handler / rAF loop mutates these without
  // re-rendering.
  const mx = useMemo(() => glassValue(0.5), []);
  const my = useMemo(() => glassValue(0.5), []);

  // rAF hot-path state lives in refs — no React state, no re-renders.
  const pointerInsideRef = useRef(false);
  const pointerPosRef = useRef({ x: 0.5, y: 0.5 });
  // Current eased position, tracked so we can lerp without reading the
  // glassValue back (keeps the loop independent of the library's getter API).
  const curXRef = useRef(0.5);
  const curYRef = useRef(0.5);

  // Lens dims + container size as refs so the rAF closure reads current
  // values without restarting the loop (width/height change via geometry
  // sliders at runtime).
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const containerSizeRef = useRef({ width: 0, height: 0 });
  useLayoutEffect(() => {
    widthRef.current = width;
    heightRef.current = height;
  }, [width, height]);

  // Track the container's rendered size so the lens can be clamped to stay
  // fully inside it (the container has overflow: hidden, so an unclamped
  // lens near an edge gets clipped).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      containerSizeRef.current = { width: r.width, height: r.height };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Clamp a 0..1 centre so the lens stays fully inside the container.
  // Returns the clamped {x, y}. When the lens is larger than the container
  // on an axis, that axis rests at 0.5 (centred, unavoidable clip).
  const clampCenter = (x: number, y: number): { x: number; y: number } => {
    const { width: cw, height: ch } = containerSizeRef.current;
    const w = widthRef.current;
    const h = heightRef.current;
    let cx = 0.5;
    let cy = 0.5;
    if (cw > 0 && w <= cw) {
      const minX = (w / 2 + LENS_INSET_PX) / cw;
      cx = Math.max(minX, Math.min(1 - minX, x));
    }
    if (ch > 0 && h <= ch) {
      const minY = (h / 2 + LENS_INSET_PX) / ch;
      cy = Math.max(minY, Math.min(1 - minY, y));
    }
    return { x: cx, y: cy };
  };

  // Map a 0..1 pattern output into the valid centre range on an axis, so
  // auto-traversal covers the full area the lens can reach without clipping.
  const mapPattern = (p: number, axis: 'x' | 'y'): number => {
    const { width: cw, height: ch } = containerSizeRef.current;
    const lens = axis === 'x' ? widthRef.current : heightRef.current;
    const cont = axis === 'x' ? cw : ch;
    if (cont <= 0 || lens >= cont) return 0.5;
    const min = (lens / 2 + LENS_INSET_PX) / cont;
    const max = 1 - min;
    return min + p * (max - min);
  };
  // Auto-cycle phase (seconds). Pauses while the pointer is inside in
  // both-on mode so the resume is seamless.
  const tRef = useRef(0);
  const lastTsRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // Random-walk stateful target + when to pick the next.
  const randomTargetRef = useRef({ x: 0.5, y: 0.5 });
  const randomNextRef = useRef(0);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    containerSizeRef.current = { width: rect.width, height: rect.height };
    const rawX = clamp01((e.clientX - rect.left) / rect.width);
    const rawY = clamp01((e.clientY - rect.top) / rect.height);
    const { x, y } = clampCenter(rawX, rawY);
    pointerPosRef.current = { x, y };
    pointerInsideRef.current = true;
    // Pure-follow mode (no rAF): exact 60fps tracking, current behavior.
    if (!independent && followCursor) {
      curXRef.current = x;
      curYRef.current = y;
      mx.set(x);
      my.set(y);
    }
  };

  const handlePointerLeave = () => {
    pointerInsideRef.current = false;
    // Pure-follow mode: snap back to centre, current behavior.
    if (!independent && followCursor) {
      const { x, y } = clampCenter(0.5, 0.5);
      curXRef.current = x;
      curYRef.current = y;
      mx.set(x);
      my.set(y);
    }
    // In independent mode the rAF loop handles the eased return.
  };

  // Start/stop the auto-traversal loop. Restarts when the motion props
  // change so the closure captures fresh values.
  useEffect(() => {
    if (!independent) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = 0;
      // Both off → rest at centre.
      if (!followCursor) {
        const { x, y } = clampCenter(0.5, 0.5);
        curXRef.current = x;
        curYRef.current = y;
        mx.set(x);
        my.set(y);
      }
      return;
    }

    lastTsRef.current = 0;

    const loop = (ts: number) => {
      if (lastTsRef.current === 0) lastTsRef.current = ts;
      // Clamp dt so a backgrounded tab doesn't fast-forward the cycle.
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      const follow = followCursor && pointerInsideRef.current;
      let targetX: number;
      let targetY: number;

      if (follow) {
        // Pointer inside + follow on: ease to the cursor, pause the cycle.
        targetX = pointerPosRef.current.x;
        targetY = pointerPosRef.current.y;
      } else {
        // Advance the cycle and read the pattern.
        tRef.current += dt;
        if (movementPattern === 'random') {
          if (tRef.current >= randomNextRef.current) {
            randomTargetRef.current = {
              x: 0.1 + Math.random() * 0.8,
              y: 0.1 + Math.random() * 0.8,
            };
            randomNextRef.current = tRef.current + RANDOM_HOLD;
          }
          targetX = randomTargetRef.current.x;
          targetY = randomTargetRef.current.y;
        } else {
          const p = AUTO_PATTERNS[movementPattern](tRef.current);
          targetX = p.x;
          targetY = p.y;
        }
        // Map the 0..1 pattern output into the valid centre range so the
        // lens traverses the full area it can reach without clipping.
        targetX = mapPattern(targetX, 'x');
        targetY = mapPattern(targetY, 'y');
      }

      // Frame-rate-independent ease toward the target.
      const k = 1 - Math.pow(1 - EASE_RATE, dt * 60);
      curXRef.current = curXRef.current + (targetX - curXRef.current) * k;
      curYRef.current = curYRef.current + (targetY - curYRef.current) * k;
      mx.set(curXRef.current);
      my.set(curYRef.current);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [independent, followCursor, movementPattern, mx, my]);

  return (
    <div
      ref={containerRef}
      className={className}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Glass
        width={width}
        height={height}
        radius={radius}
        center={{ x: mx, y: my }}
        optics={{ ...ORB_DEFAULT, ...optics }}
        filterResolution={2}
      >
        {children}
      </Glass>
    </div>
  );
}
