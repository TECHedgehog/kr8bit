import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type LibraryPanel = 'advanced' | 'settings';

interface NavigationPreferences {
  rememberSettingsCategory: boolean;
  rememberLibraryPanel: boolean;
  lastSettingsCategory: string | null;
  lastLibraryPanel: LibraryPanel | null;
}

interface NavigationPreferencesContextValue extends NavigationPreferences {
  setRememberSettingsCategory: (value: boolean) => void;
  setRememberLibraryPanel: (value: boolean) => void;
  setLastSettingsCategory: (value: string) => void;
  setLastLibraryPanel: (value: LibraryPanel | null) => void;
}

const STORAGE_KEY = 'kr8bit-navigation-preferences';
const DEFAULT_PREFERENCES: NavigationPreferences = {
  rememberSettingsCategory: true,
  rememberLibraryPanel: true,
  lastSettingsCategory: null,
  lastLibraryPanel: null,
};

function loadPreferences(): NavigationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<NavigationPreferences>;
    return {
      rememberSettingsCategory: typeof parsed.rememberSettingsCategory === 'boolean'
        ? parsed.rememberSettingsCategory
        : DEFAULT_PREFERENCES.rememberSettingsCategory,
      rememberLibraryPanel: typeof parsed.rememberLibraryPanel === 'boolean'
        ? parsed.rememberLibraryPanel
        : DEFAULT_PREFERENCES.rememberLibraryPanel,
      lastSettingsCategory: typeof parsed.lastSettingsCategory === 'string'
        ? parsed.lastSettingsCategory
        : null,
      lastLibraryPanel: parsed.lastLibraryPanel === 'advanced' || parsed.lastLibraryPanel === 'settings'
        ? parsed.lastLibraryPanel
        : null,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(preferences: NavigationPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage errors; navigation remains usable.
  }
}

const NavigationPreferencesContext = createContext<NavigationPreferencesContextValue | null>(null);

export function NavigationPreferencesProvider({ children }: { children: ReactNode }): JSX.Element {
  const [preferences, setPreferences] = useState<NavigationPreferences>(loadPreferences);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const setRememberSettingsCategory = useCallback((rememberSettingsCategory: boolean) => {
    setPreferences((previous) => previous.rememberSettingsCategory === rememberSettingsCategory
      ? previous
      : { ...previous, rememberSettingsCategory });
  }, []);
  const setRememberLibraryPanel = useCallback((rememberLibraryPanel: boolean) => {
    setPreferences((previous) => previous.rememberLibraryPanel === rememberLibraryPanel
      ? previous
      : { ...previous, rememberLibraryPanel });
  }, []);
  const setLastSettingsCategory = useCallback((lastSettingsCategory: string) => {
    setPreferences((previous) => previous.lastSettingsCategory === lastSettingsCategory
      ? previous
      : { ...previous, lastSettingsCategory });
  }, []);
  const setLastLibraryPanel = useCallback((lastLibraryPanel: LibraryPanel | null) => {
    setPreferences((previous) => previous.lastLibraryPanel === lastLibraryPanel
      ? previous
      : { ...previous, lastLibraryPanel });
  }, []);

  const value = useMemo<NavigationPreferencesContextValue>(() => ({
    ...preferences,
    setRememberSettingsCategory,
    setRememberLibraryPanel,
    setLastSettingsCategory,
    setLastLibraryPanel,
  }), [preferences, setRememberSettingsCategory, setRememberLibraryPanel, setLastSettingsCategory, setLastLibraryPanel]);

  return <NavigationPreferencesContext.Provider value={value}>{children}</NavigationPreferencesContext.Provider>;
}

export function useNavigationPreferences(): NavigationPreferencesContextValue {
  const context = useContext(NavigationPreferencesContext);
  if (!context) throw new Error('useNavigationPreferences must be used within NavigationPreferencesProvider');
  return context;
}
