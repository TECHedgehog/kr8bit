import { useLayoutEffect, useMemo, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Glass,
  animateGlassValue,
  glassEase,
  glassValue,
} from '@samasante/liquid-glass';
import IconDeviceGamepad2 from '@tabler/icons-react/dist/esm/icons/IconDeviceGamepad2.mjs';
import IconScan from '@tabler/icons-react/dist/esm/icons/IconScan.mjs';
import IconLibrary from '@tabler/icons-react/dist/esm/icons/IconLibrary.mjs';
import IconSun from '@tabler/icons-react/dist/esm/icons/IconSun.mjs';
import IconMoon from '@tabler/icons-react/dist/esm/icons/IconMoon.mjs';
import IconGlassFull from '@tabler/icons-react/dist/esm/icons/IconGlassFull.mjs';
import type { IconProps } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlowFollow } from '../../hooks/useGlowFollow';
import { useGlassTune } from '../../context/GlassTuneContext';

type TablerIcon = ComponentType<IconProps>;

interface NavItem {
  to: string;
  label: string;
  icon: TablerIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/games', label: 'Library', icon: IconLibrary },
  { to: '/scan', label: 'Scan', icon: IconScan },
  { to: '/glass-test', label: 'Glass', icon: IconGlassFull },
];

const PILL_ANIMATION = { duration: 0.4, ease: glassEase };

// Fixed lens clearance so the Glass container size never changes when pill
// geometry is tuned. If the container resized with pill width/height, the
// package's internal size (ResizeObserver) lagged our lensX fraction by a
// frame, shifting the lens off-center and clamping the clip-path at the stale
// edge. Fixed clearance = slider maxes (GlassTuneContext.tsx
// GEOMETRY_SLIDERS_BY_TARGET.pill: width max 300, height max 80).
const PILL_CLEARANCE_X = 150;
const PILL_CLEARANCE_Y = 80;

export function TopBar(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const shellRef = useRef<HTMLElement>(null);
  useGlowFollow(shellRef);
  const location = useLocation();
  const { pill } = useGlassTune();
  const navRef = useRef<HTMLDivElement>(null);
  const lensX = useMemo(() => glassValue(0.5), []);

  // Slide the glass pill lens so its center sits on the active nav entry's
  // center. The motion value is a 0..1 fraction of the glass container width.
  // The glass container includes padding (lens clearance) so its visual bounds
  // differ from the .topbar-glass-nav layout box (negative margin cancels the
  // padding's layout footprint). Query the glass container directly so the
  // fraction matches the width the package applies it to.
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
    animateGlassValue(lensX, Math.max(0, Math.min(1, fraction)), PILL_ANIMATION);
  }, [location.pathname, lensX]);

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
            <item.icon size={16} />
            <span>{item.label}</span>
          </div>
        ),
      )}
    </div>
  );

  const behind = theme === 'dark' ? '#1a1d24' : '#f0f1f4';

  return (
    <header ref={shellRef} className="topbar-shell glow-follow">
      <div className="topbar-bg" aria-hidden="true" />
      <div className="topbar">
        <div className="topbar-logo">
          <IconDeviceGamepad2 size={24} />
          <span>kr8bit</span>
        </div>
        <nav className="topbar-nav">
          <div ref={navRef} className="topbar-glass-nav">
            <Glass
              optics={pill.effectiveOptics}
              width={pill.geometry.width}
              height={pill.geometry.height}
              radius={pill.geometry.radius}
              center={{ x: lensX, y: 0.5 }}
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
        </nav>
        <div className="topbar-spacer" />
        <div className="topbar-actions">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
