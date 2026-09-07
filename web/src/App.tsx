import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { NotFoundPage } from './pages/NotFoundPage';

// Route-level code splitting: the games grid, scanner admin, detail dialog
// (vidstack + hls.js), and glass playground (liquid-glass) each load on
// first visit instead of weighing down the initial bundle.
const GamesPage = lazy(() => import('./pages/GamesPage').then((m) => ({ default: m.GamesPage })));
const ScanPage = lazy(() => import('./pages/ScanPage').then((m) => ({ default: m.ScanPage })));
const GameDetailCard = lazy(() =>
  import('./components/GameDetailCard').then((m) => ({ default: m.GameDetailCard })),
);
const GlassTestPage = lazy(() =>
  import('./pages/GlassTestPage').then((m) => ({ default: m.GlassTestPage })),
);

export function App(): JSX.Element {
  return (
    <Suspense fallback={<div className="muted">Loading…</div>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/games" replace />} />
          <Route path="/games" element={<GamesPage />}>
            <Route index element={null} />
            <Route path=":id" element={<GameDetailCard />} />
          </Route>
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/glass-test" element={<GlassTestPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
