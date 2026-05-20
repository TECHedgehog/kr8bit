import type { HowLongToBeatData } from '../../types'
import { Clock } from 'lucide-react'

interface HowLongToBeatCardProps {
  data: HowLongToBeatData | null
}

function formatHours(mins: number | null): string {
  if (mins === null || mins === undefined) return '—'
  const h = mins / 60
  if (h < 1) return `${Math.round(mins)}m`
  return `${h.toFixed(1)}h`
}

const ROWS: { key: keyof HowLongToBeatData; label: string; color: string }[] = [
  { key: 'time_main', label: 'Main Story', color: 'bg-blue-500' },
  { key: 'time_plus', label: 'Main + Extras', color: 'bg-purple-500' },
  { key: 'time_100', label: 'Completionist', color: 'bg-orange-500' },
]

export default function HowLongToBeatCard({ data }: HowLongToBeatCardProps) {
  if (!data) return null

  const maxTime = Math.max(
    data.time_main || 0,
    data.time_plus || 0,
    data.time_100 || 0,
  )

  if (maxTime === 0) return null

  return (
    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3 flex items-center gap-2">
        <Clock className="w-3 h-3" />
        How Long To Beat
      </h3>
      <div className="space-y-3">
        {ROWS.map(({ key, label, color }) => {
          const mins = data[key] as number | null
          if (!mins) return null
          const pct = maxTime > 0 ? (mins / maxTime) * 100 : 0
          const countKey = key.replace('time_', 'count_') as keyof HowLongToBeatData
          const count = data[countKey] as number | null

          return (
            <div key={key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-[var(--text-secondary)]">{label}</span>
                <span className="font-medium">{formatHours(mins)}</span>
              </div>
              <div className="w-full h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
              {count !== null && count > 0 && (
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{count} submissions</p>
              )}
            </div>
          )
        })}
      </div>
      {data.hltb_url && (
        <a
          href={data.hltb_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-xs text-[var(--accent)] hover:underline"
        >
          View on HowLongToBeat →
        </a>
      )}
    </div>
  )
}
