import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { GlassTuneProvider } from '../../context/GlassTuneContext';

export function AppLayout(): JSX.Element {
  return (
    <div className="app-layout">
      <GlassTuneProvider>
        <TopBar />
        <main className="app-content">
          <Outlet />
        </main>
      </GlassTuneProvider>
    </div>
  );
}
