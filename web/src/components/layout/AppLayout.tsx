import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { GlassTuneProvider } from '../../context/GlassTuneContext';
import { EffectsSettingsProvider } from '../../context/EffectsSettingsContext';
import { GlobalEffectsLayer } from '../effects/GlobalEffectsLayer';

export function AppLayout(): JSX.Element {
  return (
    <div className="app-layout">
      <EffectsSettingsProvider>
        <GlassTuneProvider>
          <GlobalEffectsLayer />
          <TopBar />
          <main className="app-content">
            <Outlet />
          </main>
        </GlassTuneProvider>
      </EffectsSettingsProvider>
    </div>
  );
}
