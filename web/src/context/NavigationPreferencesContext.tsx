import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { usePersistedSettings } from '../hooks/usePersistedSettings';

type LibraryPanel = 'advanced' | 'settings';
type RepackCatalogPanel = 'advanced' | 'settings';

interface NavigationPreferences {
  rememberSettingsCategory: boolean;
  rememberLibraryPanel: boolean;
  rememberRepackCatalogPanel: boolean;
  lastSettingsCategory: string | null;
  lastLibraryPanel: LibraryPanel | null;
  lastRepackCatalogPanel: RepackCatalogPanel | null;
}

interface NavigationPreferencesContextValue extends NavigationPreferences {
  setRememberSettingsCategory: (value: boolean) => void;
  setRememberLibraryPanel: (value: boolean) => void;
  setRememberRepackCatalogPanel: (value: boolean) => void;
  setLastSettingsCategory: (value: string) => void;
  setLastLibraryPanel: (value: LibraryPanel | null) => void;
  setLastRepackCatalogPanel: (value: RepackCatalogPanel | null) => void;
}

const STORAGE_KEY = 'kr8bit-navigation-preferences';
const DEFAULT_PREFERENCES: NavigationPreferences = {
  rememberSettingsCategory: true,
  rememberLibraryPanel: true,
  rememberRepackCatalogPanel: true,
  lastSettingsCategory: null,
  lastLibraryPanel: null,
  lastRepackCatalogPanel: null,
};

function sanitizePreferences(value: unknown): NavigationPreferences {
  const parsed = value && typeof value === 'object' ? value as Partial<NavigationPreferences> : {};
  return {
    rememberSettingsCategory: typeof parsed.rememberSettingsCategory === 'boolean'
      ? parsed.rememberSettingsCategory
      : DEFAULT_PREFERENCES.rememberSettingsCategory,
    rememberLibraryPanel: typeof parsed.rememberLibraryPanel === 'boolean'
      ? parsed.rememberLibraryPanel
      : DEFAULT_PREFERENCES.rememberLibraryPanel,
    rememberRepackCatalogPanel: typeof parsed.rememberRepackCatalogPanel === 'boolean'
      ? parsed.rememberRepackCatalogPanel
      : DEFAULT_PREFERENCES.rememberRepackCatalogPanel,
    lastSettingsCategory: typeof parsed.lastSettingsCategory === 'string'
      ? parsed.lastSettingsCategory
      : null,
    lastLibraryPanel: parsed.lastLibraryPanel === 'advanced' || parsed.lastLibraryPanel === 'settings'
      ? parsed.lastLibraryPanel
      : null,
    lastRepackCatalogPanel: parsed.lastRepackCatalogPanel === 'advanced' || parsed.lastRepackCatalogPanel === 'settings'
      ? parsed.lastRepackCatalogPanel
      : null,
  };
}

const NavigationPreferencesContext = createContext<NavigationPreferencesContextValue | null>(null);

export function NavigationPreferencesProvider({ children }: { children: ReactNode }): JSX.Element {
  const [preferences, setPreferences] = usePersistedSettings(STORAGE_KEY, DEFAULT_PREFERENCES, sanitizePreferences);

  const setRememberSettingsCategory = useCallback((rememberSettingsCategory: boolean) => {
    setPreferences((previous) => previous.rememberSettingsCategory === rememberSettingsCategory
      ? previous
      : { ...previous, rememberSettingsCategory });
  }, [setPreferences]);
  const setRememberLibraryPanel = useCallback((rememberLibraryPanel: boolean) => {
    setPreferences((previous) => previous.rememberLibraryPanel === rememberLibraryPanel
      ? previous
      : { ...previous, rememberLibraryPanel });
  }, [setPreferences]);
  const setRememberRepackCatalogPanel = useCallback((rememberRepackCatalogPanel: boolean) => {
    setPreferences((previous) => previous.rememberRepackCatalogPanel === rememberRepackCatalogPanel
      ? previous
      : { ...previous, rememberRepackCatalogPanel });
  }, [setPreferences]);
  const setLastSettingsCategory = useCallback((lastSettingsCategory: string) => {
    setPreferences((previous) => previous.lastSettingsCategory === lastSettingsCategory
      ? previous
      : { ...previous, lastSettingsCategory });
  }, [setPreferences]);
  const setLastLibraryPanel = useCallback((lastLibraryPanel: LibraryPanel | null) => {
    setPreferences((previous) => previous.lastLibraryPanel === lastLibraryPanel
      ? previous
      : { ...previous, lastLibraryPanel });
  }, [setPreferences]);

  const setLastRepackCatalogPanel = useCallback((lastRepackCatalogPanel: RepackCatalogPanel | null) => {
    setPreferences((previous) => previous.lastRepackCatalogPanel === lastRepackCatalogPanel
      ? previous
      : { ...previous, lastRepackCatalogPanel });
  }, [setPreferences]);

  const value = useMemo<NavigationPreferencesContextValue>(() => ({
    ...preferences,
    setRememberSettingsCategory,
    setRememberLibraryPanel,
    setRememberRepackCatalogPanel,
    setLastSettingsCategory,
    setLastLibraryPanel,
    setLastRepackCatalogPanel,
  }), [preferences, setRememberSettingsCategory, setRememberLibraryPanel, setRememberRepackCatalogPanel, setLastSettingsCategory, setLastLibraryPanel, setLastRepackCatalogPanel]);

  return <NavigationPreferencesContext.Provider value={value}>{children}</NavigationPreferencesContext.Provider>;
}

export function useNavigationPreferences(): NavigationPreferencesContextValue {
  const context = useContext(NavigationPreferencesContext);
  if (!context) throw new Error('useNavigationPreferences must be used within NavigationPreferencesProvider');
  return context;
}
