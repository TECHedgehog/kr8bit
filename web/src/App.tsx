import { useState } from 'react';
import { ScanPage } from './pages/ScanPage';
import { GamesPage } from './pages/GamesPage';
import { GameDetailPage } from './pages/GameDetailPage';

type Page =
  | { name: 'scan' }
  | { name: 'games' }
  | { name: 'detail'; gameId: string };

const TABS = [
  { name: 'scan' as const, label: 'Scan' },
  { name: 'games' as const, label: 'Games' },
];

export function App(): JSX.Element {
  const [page, setPage] = useState<Page>({ name: 'scan' });

  function openGame(id: string) {
    setPage({ name: 'detail', gameId: id });
  }

  function backToGames() {
    setPage({ name: 'games' });
  }

  const activeTab = page.name === 'detail' ? 'games' : page.name;

  return (
    <div className="app">
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.name}
            className={`tab${activeTab === t.name ? ' active' : ''}`}
            onClick={() => setPage(t.name === 'scan' ? { name: 'scan' } : { name: 'games' })}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className="content">
        {page.name === 'scan' && <ScanPage />}
        {page.name === 'games' && <GamesPage onOpenGame={openGame} />}
        {page.name === 'detail' && (
          <GameDetailPage gameId={page.gameId} onBack={backToGames} />
        )}
      </main>
    </div>
  );
}