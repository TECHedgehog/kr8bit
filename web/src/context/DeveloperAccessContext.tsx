import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type DeveloperAccessState = {
  enabled: boolean;
  unlocked: boolean;
};

const DeveloperAccessContext = createContext<DeveloperAccessState | null>(null);

export function DeveloperAccessProvider({ children }: { children: ReactNode }): JSX.Element {
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/developer/status');
    if (!response.ok) return;
    const status = (await response.json()) as { enabled: boolean; unlocked: boolean };
    setEnabled(status.enabled);
    setUnlocked(status.unlocked);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo(() => ({ enabled, unlocked }), [enabled, unlocked]);
  return <DeveloperAccessContext.Provider value={value}>{children}</DeveloperAccessContext.Provider>;
}

export function useDeveloperAccess(): DeveloperAccessState {
  const context = useContext(DeveloperAccessContext);
  if (!context) throw new Error('useDeveloperAccess must be used within DeveloperAccessProvider');
  return context;
}
