import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTiltGlow } from '../../hooks/useTiltGlow';
import { Gamepad2, ScanLine, Library, Sun, Moon, type LucideIcon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/games', label: 'Library', icon: Library },
  { to: '/scan', label: 'Scan', icon: ScanLine },
];

export function TopBar(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const themeRef = useRef<HTMLButtonElement>(null);
  useTiltGlow(headerRef);
  useTiltGlow(themeRef);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
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
    <header ref={headerRef} className="topbar tilt-glow">
      <div className="topbar-logo">
        <Gamepad2 size={24} />
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
          ref={themeRef}
          className="theme-toggle tilt-glow"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}