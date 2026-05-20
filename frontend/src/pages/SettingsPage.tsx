import { useSearchParams, useNavigate } from 'react-router-dom'
import { Database, Sparkles, Server, Library } from 'lucide-react'
import ScraperSection from '../components/settings/ScraperSection'
import EnrichmentSection from '../components/settings/EnrichmentSection'
import DownloadClientsSection from '../components/settings/DownloadClientsSection'
import LibrarySection from '../components/settings/LibrarySection'

const TABS = [
  { key: 'scraper', label: 'Scraper', icon: Database },
  { key: 'enrichment', label: 'Enrichment', icon: Sparkles },
  { key: 'clients', label: 'Download Clients', icon: Server },
  { key: 'library', label: 'Library', icon: Library },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const activeTab = (searchParams.get('tab') as TabKey) || 'scraper'

  const setTab = (tab: TabKey) => {
    navigate(`/settings?tab=${tab}`, { replace: true })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <nav className="shrink-0 w-full md:w-52 space-y-1">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            )
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-6">
          {activeTab === 'scraper' && <ScraperSection />}
          {activeTab === 'enrichment' && <EnrichmentSection />}
          {activeTab === 'clients' && <DownloadClientsSection />}
          {activeTab === 'library' && <LibrarySection />}
        </div>
      </div>
    </div>
  )
}
