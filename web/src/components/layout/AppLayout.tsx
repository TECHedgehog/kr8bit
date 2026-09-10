import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { GlassTuneProvider } from '../../context/GlassTuneContext';
import { EffectsSettingsProvider } from '../../context/EffectsSettingsContext';
import { GlobalEffectsLayer } from '../effects/GlobalEffectsLayer';
import { PerformanceSettingsProvider } from '../../context/PerformanceSettingsContext';

export function AppLayout(): JSX.Element {
  return (
    <div className="app-layout">
      <PerformanceSettingsProvider>
        <EffectsSettingsProvider>
          <GlassTuneProvider>
          <GlobalEffectsLayer />
          <TopBar />
          <main className="app-content">
            <Outlet />
          </main>
          </GlassTuneProvider>
        </EffectsSettingsProvider>
      </PerformanceSettingsProvider>
    </div>
  );
}
