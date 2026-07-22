import { NavLink } from 'react-router-dom';
import { Gamepad2, ScanLine, Library, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function TopBar(): JSX.Element {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <Gamepad2 size={24} />
        <span>kr8bit</span>
      </div>
      <nav className="topbar-nav">
        <NavLink to="/games" className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}>
          <Library size={16} />
          <span>Library</span>
        </NavLink>
        <NavLink to="/scan" className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}>
          <ScanLine size={16} />
          <span>Scan</span>
        </NavLink>
      </nav>
      <div className="topbar-spacer" />
      <div className="topbar-actions">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}