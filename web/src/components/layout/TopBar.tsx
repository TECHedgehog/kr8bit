import { useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import IconDeviceGamepad2 from '@tabler/icons-react/dist/esm/icons/IconDeviceGamepad2.mjs';
import IconScan from '@tabler/icons-react/dist/esm/icons/IconScan.mjs';
import IconLibrary from '@tabler/icons-react/dist/esm/icons/IconLibrary.mjs';
import IconSun from '@tabler/icons-react/dist/esm/icons/IconSun.mjs';
import IconFlask from '@tabler/icons-react/dist/esm/icons/IconFlask.mjs';
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
  const shellRef = useRef<HTMLElement>(null);
  useGlowFollow(shellRef);

  return (
    <header ref={shellRef} className="topbar-shell glow-follow">
      <div className="topbar-bg" aria-hidden="true" />
      <div className="topbar">
        <div className="topbar-logo">
          <IconDeviceGamepad2 size={24} />
          <span>kr8bit</span>
        </div>
        <nav className="topbar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="topbar-spacer" />
        <div className="topbar-actions">
          <Link
            to="/glass-test"
            className="theme-toggle"
            aria-label="Glass test page"
          >
            <IconFlask size={18} />
          </Link>
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
