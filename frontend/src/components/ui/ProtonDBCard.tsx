import type { ProtonDBData } from '../../types'
import SteamDeckBadge from './SteamDeckBadge'

const TIER_COLORS: Record<string, string> = {
  platinum: '#b4eeb4',
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
  borked: '#ff4444',
}

interface ProtonDBCardProps {
  data: ProtonDBData | null
}

export default function ProtonDBCard({ data }: ProtonDBCardProps) {
  if (!data) return null

  const protonColor = TIER_COLORS[data.proton_tier] || '#888'
  const url = `https://www.protondb.com/app/${data.steam_app_id}`

  return (
    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
        ProtonDB
      </h3>

      <div className="space-y-3">
        {/* Steam Deck */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Steam Deck</span>
          <SteamDeckBadge data={data} size="sm" />
        </div>

        {/* Proton Tier */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Proton Tier</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: protonColor }} />
            <span className="capitalize">{data.proton_tier}</span>
          </a>
        </div>

        {/* Score & Reports */}
        {data.score !== null && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">Score</span>
            <span className="text-sm font-medium">{(data.score * 100).toFixed(0)}%</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Reports</span>
          <span className="text-sm font-medium">{data.total_reports.toLocaleString()}</span>
        </div>

        {/* Confidence */}
        {data.confidence && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">Confidence</span>
            <span className="text-sm font-medium capitalize">{data.confidence}</span>
          </div>
        )}
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block text-xs text-[var(--accent)] hover:underline"
      >
        View on ProtonDB →
      </a>
    </div>
  )
}
