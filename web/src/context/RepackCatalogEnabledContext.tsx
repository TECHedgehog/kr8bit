import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';

interface RepackCatalogSettings { enabled: boolean }
interface RepackCatalogEnabledValue { enabled: boolean; refresh: () => Promise<void> }

const RepackCatalogEnabledContext = createContext<RepackCatalogEnabledValue>({
  enabled: false,
  refresh: async () => undefined,
});

export function RepackCatalogEnabledProvider({ children }: { children: ReactNode }): JSX.Element {
  const [enabled, setEnabled] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const settings = await api.get<RepackCatalogSettings>('/api/repack-catalog/settings');
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
