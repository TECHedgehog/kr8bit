import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { DeveloperAccessProvider } from './context/DeveloperAccessContext';
import { RepackCatalogEnabledProvider } from './context/RepackCatalogEnabledContext';

// Route-level code splitting: the games grid and detail dialog (vidstack +
// hls.js) each load on first visit instead of weighing down the initial bundle.
const GamesPage = lazy(() => import('./pages/GamesPage').then((m) => ({ default: m.GamesPage })));
const GameDetailCard = lazy(() =>
  import('./components/GameDetailCard').then((m) => ({ default: m.GameDetailCard })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const RepackCatalogPage = lazy(() => import('./pages/RepackCatalogPage').then((m) => ({ default: m.RepackCatalogPage })));
const RepackDetailCard = lazy(() => import('./components/RepackDetailCard').then((m) => ({ default: m.RepackDetailCard })));

export function App(): JSX.Element {
  return (
    <Suspense fallback={<div className="muted">Loading…</div>}>
      <RepackCatalogEnabledProvider>
      <DeveloperAccessProvider>
        <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/games" replace />} />
          <Route path="/games" element={<GamesPage />}>
            <Route index element={null} />
            <Route path=":id" element={<GameDetailCard />} />
          </Route>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/repack-catalog" element={<RepackCatalogPage />}>
            <Route index element={null} />
            <Route path=":id" element={<RepackDetailCard />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        </Routes>
      </DeveloperAccessProvider>
      </RepackCatalogEnabledProvider>
    </Suspense>
  );
}
