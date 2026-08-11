import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import IconDeviceGamepad2 from '@tabler/icons-react/dist/esm/icons/IconDeviceGamepad2.mjs';
import IconScan from '@tabler/icons-react/dist/esm/icons/IconScan.mjs';
import IconLibrary from '@tabler/icons-react/dist/esm/icons/IconLibrary.mjs';
import IconSun from '@tabler/icons-react/dist/esm/icons/IconSun.mjs';
import IconMoon from '@tabler/icons-react/dist/esm/icons/IconMoon.mjs';
import type { IconProps } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlowFollow } from '../../hooks/useGlowFollow';

type TablerIcon = ComponentType<IconProps>;

interface NavItem {
  to: string;
  label: string;
  icon: TablerIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/games', label: 'Library', icon: IconLibrary },
  { to: '/scan', label: 'Scan', icon: IconScan },
];

export function TopBar(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  useGlowFollow(shellRef);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const [suppressTransition, setSuppressTransition] = useState(true);
  const [fontReady, setFontReady] = useState(false);
  const [indicatorStyle, setIndicatorStyle] = useState<{ translate: string; width: string; opacity: number }>({
    translate: '0px 0',
    width: '0px',
    opacity: 0,
  });

  useLayoutEffect(() => {
    const activeIndex = NAV_ITEMS.findIndex((item) => location.pathname.startsWith(item.to));
    const link = linkRefs.current[activeIndex];
    const nav = navRef.current;
    if (!link || !nav || activeIndex === -1) {
      setIndicatorStyle((s) => ({ ...s, opacity: 0 }));
      return;
    }
    setIndicatorStyle({
      translate: `${link.offsetLeft}px 0`,
      width: `${link.offsetWidth}px`,
      opacity: 1,
    });

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const el = indicatorRef.current;
    if (el) {
      el.classList.remove('topbar-indicator--moving');
      void el.offsetWidth;
      el.classList.add('topbar-indicator--moving');
    }
  }, [location.pathname]);

  useEffect(() => {
    requestAnimationFrame(() => setSuppressTransition(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (cancelled) return;
      setFontReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (!fontReady) return;
    const activeIndex = NAV_ITEMS.findIndex((item) => location.pathname.startsWith(item.to));
    const link = linkRefs.current[activeIndex];
    const nav = navRef.current;
    if (!link || !nav || activeIndex === -1) return;
    setSuppressTransition(true);
    setIndicatorStyle({
      translate: `${link.offsetLeft}px 0`,
      width: `${link.offsetWidth}px`,
      opacity: 1,
    });
    requestAnimationFrame(() => setSuppressTransition(false));
  }, [fontReady]);

  return (
    <header ref={shellRef} className="topbar-shell glow-follow">
      <div className="topbar-bg" aria-hidden="true" />
      <div className="topbar">
        <div className="topbar-logo">
          <IconDeviceGamepad2 size={24} />
          <span>kr8bit</span>
        </div>
        <nav className="topbar-nav" ref={navRef}>
          <div
            ref={indicatorRef}
            className={`topbar-indicator${suppressTransition ? ' topbar-indicator--no-transition' : ''}`}
            style={indicatorStyle}
            onAnimationEnd={() => indicatorRef.current?.classList.remove('topbar-indicator--moving')}
          />
          {NAV_ITEMS.map((item, i) => (
            <NavLink
              key={item.to}
              to={item.to}
              ref={(el) => { linkRefs.current[i] = el; }}
              className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          ))}
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
