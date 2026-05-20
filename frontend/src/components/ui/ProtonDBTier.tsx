import type { ProtonDBData } from '../../types'

const TIER_COLORS: Record<string, string> = {
  platinum: '#b4eeb4',
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
  borked: '#ff4444',
}

interface ProtonDBTierProps {
  data: ProtonDBData | null
}

export default function ProtonDBTier({ data }: ProtonDBTierProps) {
  if (!data || !data.proton_tier) return null

  const color = TIER_COLORS[data.proton_tier] || '#888'
  const url = `https://www.protondb.com/app/${data.steam_app_id}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors"
      title={`ProtonDB: ${data.proton_tier} (${data.confidence}, ${data.total_reports} reports)`}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="capitalize">{data.proton_tier}</span>
      {data.score !== null && (
        <span className="text-[var(--text-secondary)]">· {(data.score * 100).toFixed(0)}%</span>
      )}
    </a>
  )
}
