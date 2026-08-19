import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ScanPage } from './pages/ScanPage';
import { GamesPage } from './pages/GamesPage';
import { GameDetailCard } from './components/GameDetailCard';
import { GlassTestPage } from './pages/GlassTestPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App(): JSX.Element {
  return (
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
  );
}