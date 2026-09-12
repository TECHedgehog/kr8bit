import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { TopBar } from './TopBar';
import { GlassTuneProvider } from '../../context/GlassTuneContext';
import { EffectsSettingsProvider } from '../../context/EffectsSettingsContext';
import { GlobalEffectsLayer } from '../effects/GlobalEffectsLayer';
import { PerformanceSettingsProvider } from '../../context/PerformanceSettingsContext';
import { api } from '../../api/client';

export function AppLayout(): JSX.Element {
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    void api.get<{ enabled: boolean }>('/api/demo/status')
      .then((status) => setDemoMode(status.enabled))
      .catch(() => undefined);
  }, []);

  return (
    <div className="app-layout">
      <PerformanceSettingsProvider>
        <EffectsSettingsProvider>
          <GlassTuneProvider>
          <GlobalEffectsLayer />
           <TopBar />
           {demoMode && <div className="demo-banner" role="status">demo mode · sample data · offline</div>}
          <main className="app-content">
            <Outlet />
          </main>
          </GlassTuneProvider>
        </EffectsSettingsProvider>
      </PerformanceSettingsProvider>
    </div>
  );
}
