import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Header from './components/layout/Header'
import LocalLibrary from './pages/LocalLibrary'
import LibraryDetailPage from './pages/LibraryDetailPage'
import DownloadsPage from './pages/DownloadsPage'
import GameCatalog from './pages/GameCatalog'
import GameDetailPage from './pages/GameDetailPage'
import SettingsPage from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-[var(--bg-primary)]">
          <Header />
          <main className="max-w-7xl mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<LocalLibrary />} />
              <Route path="/library/:id" element={<LibraryDetailPage />} />
              <Route path="/downloads" element={<DownloadsPage />} />
              <Route path="/games" element={<GameCatalog />} />
              <Route path="/games/:id" element={<GameDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}