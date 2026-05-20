import { useStats } from '../api/games'
import { useEnrichmentStatus } from '../api/enrichment'
import { useDownloadClientsStatus } from '../api/downloadClients'
import { useScraperStatus } from '../api/scraper'
import { useNavigate } from 'react-router-dom'
import {
  Gamepad2, Star, Server, Activity, Zap,
} from 'lucide-react'

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4 hover:border-[var(--accent)]/30 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold mt-1" style={color ? { color } : undefined}>{value}</p>
          {sub && <p className="text-xs text-[var(--text-secondary)] mt-1">{sub}</p>}
        </div>
        <div className="text-[var(--text-secondary)] opacity-60">{icon}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: stats } = useStats()
  const { data: enrichment } = useEnrichmentStatus()
  const { data: dlStatus } = useDownloadClientsStatus()
  const { data: scraper } = useScraperStatus()
  const navigate = useNavigate()

  const anyConnected = dlStatus?.clients?.some(c => c.connected) ?? false
  const totalTorrents = dlStatus?.total_torrent_count ?? 0
  const totalActive = dlStatus?.total_active_count ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Gamepad2 className="w-6 h-6" />}
          label="Total Games"
          value={stats?.total_games ?? '-'}
          sub={scraper?.last_run ? `Last scrape: ${new Date(scraper.last_run).toLocaleDateString()}` : 'Not scraped yet'}
        />
        <StatCard
          icon={<Star className="w-6 h-6" />}
          label="Enriched"
          value={enrichment ? (enrichment.enriched_igdb + enrichment.enriched_steam) : '-'}
          sub={`${enrichment?.unmatched ?? '-'} unmatched, ${enrichment?.failed ?? '-'} failed`}
          color="var(--accent)"
        />
        <StatCard
          icon={<Server className="w-6 h-6" />}
          label="Downloads"
          value={anyConnected ? `${totalTorrents} torrents` : 'Offline'}
          sub={anyConnected ? `${totalActive} active` : 'Configure in Settings'}
          color={anyConnected ? 'var(--green)' : 'var(--red)'}
        />
        <StatCard
          icon={<Activity className="w-6 h-6" />}
          label="Categories"
          value={stats?.total_categories ?? '-'}
          sub={`${stats?.total_tags ?? '-'} tags`}
        />
      </div>

      {(!stats?.total_games || stats.total_games === 0) && (
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-8 text-center">
          <Zap className="w-12 h-12 mx-auto mb-4 text-[var(--accent)]" />
          <h2 className="text-lg font-medium mb-2">Welcome to Kr8bit</h2>
          <p className="text-[var(--text-secondary)] mb-4 max-w-md mx-auto">
            Start by running a full scrape to import all games, then configure metadata enrichment in Settings.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/settings?tab=scraper')}
              className="px-6 py-2 bg-[var(--accent)] text-black rounded-lg font-medium hover:opacity-80 transition-opacity"
            >
              Configure Scraper
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
