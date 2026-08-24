import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Glass,
  animateGlassValue,
  cubicBezier,
  glassValue,
} from '@samasante/liquid-glass';
import IconDeviceGamepad2 from '@tabler/icons-react/dist/esm/icons/IconDeviceGamepad2.mjs';
import { useTheme } from '../../context/ThemeContext';
import { useGlowFollow } from '../../hooks/useGlowFollow';
import { useGlassTune } from '../../context/GlassTuneContext';
import { NAV_ITEMS } from './navItems';
import { THEME_ITEMS } from './themeItems';

// Smooth S-curve — slow start + slow end. Used for the horizontal slide and
// the RAISE phase so the lens starts moving/growing slowly and decelerates
// into its peak.
const EASE_IN_OUT = cubicBezier(0.42, 0, 0.58, 1);
// Monotonic ease-out — no overshoot. Used for the LOWER phase so the lens
// settles back to idle with a slow finish.
const EASE_OUT = cubicBezier(0.33, 1, 0.68, 1);

// Move spans the whole transit. Raise peaks at ~62% of the move (0.25s / 0.4s)
// so the lens is almost at the target when the lower begins. Lower settles
// to ~0.45s — the lens lands at 0.4s and finishes shrinking at ~0.45s.
const MOVE_ANIMATION = { duration: 0.4, ease: EASE_IN_OUT };
const RAISE_ANIMATION = { duration: 0.25, ease: EASE_IN_OUT };
const LOWER_ANIMATION = { duration: 0.2, ease: EASE_OUT };

// Peak vertical grow (px) added to the idle lens height while raised. Splits
// symmetrically above + below the pill border (center.y = 0.5).
const LENS_RISE = 20;

// Fixed px gap between the lens edge and the pill border on all four sides.
// Nav pill: 48px height (override), 1px border, 3px padding → inner space
// 46px, content area 40px. With LENS_MARGIN = 1 the lens is 42px tall (2px
// gap top/bottom) and 1px wider than the link each side (2px gap left/right
// for edge links). Fully decoupled from geometry sliders — the nav lens is
// independent.
const LENS_MARGIN = 1;

// Lens corner radius. Max from the (now removed) slider config was 40.
const LENS_RADIUS = 40;

// Refraction strength (scale prop overrides optics.strength). 0 = no
// displacement. IDLE = 0 so text is crisp at rest; PEAK is the ramp during
// transit (0 → PEAK → 0 over the raise+lower). Visible for ~0.9s with the
// slower animation + LENS_DEPTH 0.85.
const LENS_SCALE_IDLE = 0;
const LENS_SCALE_PEAK = 0.05;

// How far refraction reaches inward from the lens edge, as a 0..1 fraction
// of min(halfW, halfH). At 0.5 the centre was neutral (flat, no bend). 0.85
// shrinks the neutral centre to a sliver so distortion fills nearly the
// entire lens.
const LENS_DEPTH = 0.7;

// Fixed lens clearance so the Glass container size never changes. If the
// container resized with lens width/height, the package's internal
// ResizeObserver lagged our lensX fraction by a frame, shifting the lens
// off-center and clamping the clip-path at the stale edge. Clearance = half
// the largest expected lens extent (peak height 42 + 20 = 62; width is
// dynamic per active entry, 150 stays a safe upper bound).
const PILL_CLEARANCE_X = 150;
const PILL_CLEARANCE_Y = 80;

export function TopBar(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const logoRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const navShellRef = useRef<HTMLDivElement>(null);
  useGlowFollow(logoRef);
  useGlowFollow(themeRef);
  useGlowFollow(navShellRef);
  const location = useLocation();
  const { pill } = useGlassTune();
  const navRef = useRef<HTMLDivElement>(null);
  // Tracks the very first run of the layout effect below. On initial mount we
  // SET the lens position/width/height/scale directly (no animation) so the
  // pill starts idle on the active tab instead of sliding in from centre.
  const mountedRef = useRef(false);
  // Transit token: incremented each route change so stale onComplete callbacks
  // from a superseded transit no-op (prevents a late lower from dropping the
  // lens mid-way through a newer raise).
  const transitRef = useRef(0);
  const [isMoving, setIsMoving] = useState(false);
  const lensX = useMemo(() => glassValue(0.5), []);
  // Seed once — recreating on width change would reset the imperative animation.
  // Both are immediately overwritten on mount by the layout effect below (before
  // paint) so the seed value is just a safe fallback.
  const lensW = useMemo(() => glassValue(80), []);
  const lensH = useMemo(() => glassValue(42), []);
  const lensScale = useMemo(() => glassValue(LENS_SCALE_IDLE), []);

  // ---- Theme lens (mirrors the nav lens above) ----
  // Two-icon pill (moon/sun). The lens slides to the active entry on theme
  // change with the same raise → move → lower choreography as the nav lens.
  const themeNavRef = useRef<HTMLDivElement>(null);
  const themeMountedRef = useRef(false);
  const themeTransitRef = useRef(0);
  const [themeIsMoving, setThemeIsMoving] = useState(false);
  const themeLensX = useMemo(() => glassValue(0.5), []);
  const themeLensW = useMemo(() => glassValue(40), []);
  const themeLensH = useMemo(() => glassValue(42), []);
  const themeLensScale = useMemo(() => glassValue(LENS_SCALE_IDLE), []);

  // Slide the glass pill lens so its center sits on the active nav entry's
  // center. The motion value is a 0..1 fraction of the glass container width.
  // On route change the lens slowly RAISES (grows tall + ramps refraction
  // idle → peak) while MOVING to the new target. When almost at the target
  // (raise peaks at ~62% of the move) it LOWERS back to idle height +
  // refraction — a slow, smooth lift-slide-settle with no bounce.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const glass = nav.querySelector('[data-liquid-glass]') as HTMLElement | null;
    if (!glass) return;
    const active = nav.querySelector('.topbar-link.active') as HTMLElement | null;
    if (!active) return;
    const glassRect = glass.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const activeCenter = activeRect.left + activeRect.width / 2;
    const fraction =
      glassRect.width > 0 ? (activeCenter - glassRect.left) / glassRect.width : 0.5;
    // Fixed 1px rim on all four edges of the active link. The lens is
    // LENS_MARGIN taller and wider than the link on each side, producing a
    // uniform 1px gap between the lens edge and the pill border (pill padding
    // 2px − rim 1px = 1px margin). Independent of geometry sliders.
    const rim = LENS_MARGIN;
    const targetW = activeRect.width + 2 * rim;
    const clampedFraction = Math.max(0, Math.min(1, fraction));
    const idleH = activeRect.height + 2 * LENS_MARGIN;
    const peakH = idleH + LENS_RISE;
    const peakStrength = LENS_SCALE_PEAK;

    if (!mountedRef.current) {
      lensX.set(clampedFraction);
      lensW.set(targetW);
      lensH.set(idleH);
      lensScale.set(LENS_SCALE_IDLE);
      mountedRef.current = true;
      return;
    }

    const myTransit = ++transitRef.current;
    setIsMoving(true);

    // Move — no overshoot, spans the whole transit.
    animateGlassValue(lensX, clampedFraction, MOVE_ANIMATION);
    animateGlassValue(lensW, targetW, MOVE_ANIMATION);
    // Raise: grow height + ramp refraction. On settle → lower both back.
    animateGlassValue(lensH, peakH, {
      ...RAISE_ANIMATION,
      onComplete: () => {
        if (transitRef.current !== myTransit) return; // superseded
        animateGlassValue(lensH, idleH, {
          ...LOWER_ANIMATION,
          onComplete: () => {
            if (transitRef.current !== myTransit) return;
            setIsMoving(false);
          },
        });
        animateGlassValue(lensScale, LENS_SCALE_IDLE, LOWER_ANIMATION);
      },
    });
    animateGlassValue(lensScale, peakStrength, RAISE_ANIMATION);
  }, [location.pathname, lensX, lensW, lensH, lensScale]);

  // While idle, re-sync the lens dimensions to the active link's measured rect
  // without animating. Runs when a transit settles (isMoving → false) so the
  // lens snaps to the final idle size. Skipped on first mount and during a
  // transit so it never fights the choreography above.
  useLayoutEffect(() => {
    if (!mountedRef.current || isMoving) return;
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector('.topbar-link.active') as HTMLElement | null;
    if (!active) return;
    const activeRect = active.getBoundingClientRect();
    const rim = LENS_MARGIN;
    lensH.set(activeRect.height + 2 * LENS_MARGIN);
    lensW.set(activeRect.width + 2 * rim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMoving]);

  // Slide the theme lens so its center sits on the active theme entry (moon or
  // sun). Same raise → move → lower choreography as the nav lens, keyed on the
  // theme value instead of the route.
  useLayoutEffect(() => {
    const nav = themeNavRef.current;
    if (!nav) return;
    const glass = nav.querySelector('[data-liquid-glass]') as HTMLElement | null;
    if (!glass) return;
    const active = nav.querySelector('.topbar-link.active') as HTMLElement | null;
    if (!active) return;
    const glassRect = glass.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const activeCenter = activeRect.left + activeRect.width / 2;
    const fraction =
      glassRect.width > 0 ? (activeCenter - glassRect.left) / glassRect.width : 0.5;
    const rim = LENS_MARGIN;
    const targetW = activeRect.width + 2 * rim;
    const clampedFraction = Math.max(0, Math.min(1, fraction));
    const idleH = activeRect.height + 2 * LENS_MARGIN;
    const peakH = idleH + LENS_RISE;
    const peakStrength = LENS_SCALE_PEAK;

    if (!themeMountedRef.current) {
      themeLensX.set(clampedFraction);
      themeLensW.set(targetW);
      themeLensH.set(idleH);
      themeLensScale.set(LENS_SCALE_IDLE);
      themeMountedRef.current = true;
      return;
    }

    const myTransit = ++themeTransitRef.current;
    setThemeIsMoving(true);

    animateGlassValue(themeLensX, clampedFraction, MOVE_ANIMATION);
    animateGlassValue(themeLensW, targetW, MOVE_ANIMATION);
    animateGlassValue(themeLensH, peakH, {
      ...RAISE_ANIMATION,
      onComplete: () => {
        if (themeTransitRef.current !== myTransit) return; // superseded
        animateGlassValue(themeLensH, idleH, {
          ...LOWER_ANIMATION,
          onComplete: () => {
            if (themeTransitRef.current !== myTransit) return;
            setThemeIsMoving(false);
          },
        });
        animateGlassValue(themeLensScale, LENS_SCALE_IDLE, LOWER_ANIMATION);
      },
    });
    animateGlassValue(themeLensScale, peakStrength, RAISE_ANIMATION);
  }, [theme, themeLensX, themeLensW, themeLensH, themeLensScale]);

  // While idle, re-sync the theme lens dimensions to the active entry's
  // measured rect without animating. Mirrors the nav idle re-sync above.
  useLayoutEffect(() => {
    if (!themeMountedRef.current || themeIsMoving) return;
    const nav = themeNavRef.current;
    if (!nav) return;
    const active = nav.querySelector('.topbar-link.active') as HTMLElement | null;
    if (!active) return;
    const activeRect = active.getBoundingClientRect();
    const rim = LENS_MARGIN;
    themeLensH.set(activeRect.height + 2 * LENS_MARGIN);
    themeLensW.set(activeRect.width + 2 * rim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeIsMoving]);

  const renderNavItems = (as: 'link' | 'copy') => (
    <div className="topbar-nav-items">
      {NAV_ITEMS.map((item) =>
        as === 'link' ? (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `topbar-link${isActive ? ' active' : ''}`
            }
          >
            <item.icon size={16} />
            <span>{item.label}</span>
          </NavLink>
        ) : (
          <div key={item.to} className="topbar-link">
            <item.icon size={16} color={item.color} />
            <span>{item.label}</span>
          </div>
        ),
      )}
    </div>
  );

  const renderThemeItems = (as: 'link' | 'copy') => (
    <div className="topbar-nav-items">
      {THEME_ITEMS.map((item) => {
        const isActive = theme === item.theme;
        return as === 'link' ? (
          <button
            key={item.theme}
            type="button"
            className={`topbar-link topbar-theme-link${isActive ? ' active' : ''}`}
            onClick={isActive ? undefined : toggleTheme}
            aria-label={`Switch to ${item.theme} mode`}
            aria-pressed={isActive}
          >
            <item.icon size={16} />
          </button>
        ) : (
          <div key={item.theme} className="topbar-link topbar-theme-link">
            <item.icon size={16} color={item.color} />
          </div>
        );
      })}
    </div>
  );

  const behind = theme === 'dark' ? '#1a1d24' : '#e8ebf0';

  return (
    <>
      {/* In-flow row — logo pill (left) + theme pill (right). Scrolls away. */}
      <div className="topbar-flow">
        <div ref={logoRef} className="topbar-pill topbar-logo-pill glow-follow">
          <div className="topbar-logo">
            <IconDeviceGamepad2 size={24} />
            <span>kr8bit</span>
          </div>
        </div>
        <div
          ref={themeRef}
          className={`topbar-pill topbar-theme-pill glow-follow${themeIsMoving ? ' is-moving' : ''}`}
        >
          <div ref={themeNavRef} className="topbar-glass-nav">
            <Glass
              optics={pill.effectiveOptics}
              width={themeLensW}
              height={themeLensH}
              radius={LENS_RADIUS}
              center={{ x: themeLensX, y: 0.5 }}
              scale={themeLensScale}
              depth={LENS_DEPTH}
              refract={renderThemeItems('copy')}
              behind={behind}
              filterResolution={2}
              style={{
                display: 'flex',
                width: 'fit-content',
                paddingInline: PILL_CLEARANCE_X,
                marginInline: -PILL_CLEARANCE_X,
                minHeight: PILL_CLEARANCE_Y,
                overflow: 'visible',
              }}
            >
              {renderThemeItems('link')}
            </Glass>
          </div>
        </div>
      </div>
      {/* Fixed nav pill — centered, stays on top while scrolling. */}
      <nav className="topbar-nav-fixed">
        <div
          ref={navShellRef}
          className={`topbar-pill topbar-nav-pill glow-follow${isMoving ? ' is-moving' : ''}`}
        >
          <div ref={navRef} className="topbar-glass-nav">
            <Glass
              optics={pill.effectiveOptics}
              width={lensW}
              height={lensH}
              radius={LENS_RADIUS}
              center={{ x: lensX, y: 0.5 }}
              scale={lensScale}
              depth={LENS_DEPTH}
              refract={renderNavItems('copy')}
              behind={behind}
              filterResolution={2}
              style={{
                display: 'flex',
                width: 'fit-content',
                paddingInline: PILL_CLEARANCE_X,
                marginInline: -PILL_CLEARANCE_X,
                minHeight: PILL_CLEARANCE_Y,
                overflow: 'visible',
              }}
            >
              {renderNavItems('link')}
            </Glass>
          </div>
        </div>
      </nav>
    </>
  );
}
