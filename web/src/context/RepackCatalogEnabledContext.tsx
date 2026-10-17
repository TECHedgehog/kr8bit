import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';

interface RepackCatalogSettings { enabled: boolean }
interface RepackCatalogEnabledValue { enabled: boolean; refresh: () => Promise<void> }

const ENABLED_CACHE_KEY = 'kr8bit-repack-catalog-enabled';

function readCachedEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_CACHE_KEY) === 'true';
  } catch {
    return false;
  }
}

function cacheEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(ENABLED_CACHE_KEY, String(enabled));
  } catch {
    // Storage is an optional startup cache; server settings remain authoritative.
  }
}

const RepackCatalogEnabledContext = createContext<RepackCatalogEnabledValue>({
  enabled: false,
  refresh: async () => undefined,
});

export function RepackCatalogEnabledProvider({ children }: { children: ReactNode }): JSX.Element {
  const [enabled, setEnabled] = useState(readCachedEnabled);
  const refresh = useCallback(async () => {
    try {
      const settings = await api.get<RepackCatalogSettings>('/api/repack-catalog/settings');
      cacheEnabled(settings.enabled);
      setEnabled(settings.enabled);
    } catch { setEnabled(false); }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);
  const value = useMemo(() => ({ enabled, refresh }), [enabled, refresh]);
  return <RepackCatalogEnabledContext.Provider value={value}>{children}</RepackCatalogEnabledContext.Provider>;
}

export function useRepackCatalogEnabled(): RepackCatalogEnabledValue {
  return useContext(RepackCatalogEnabledContext);
}
