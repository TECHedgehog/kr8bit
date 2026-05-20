import { Link } from 'react-router-dom'
import { Download, ArrowLeft, Loader2, PauseCircle, CheckCircle2 } from 'lucide-react'
import { useDownloads } from '../api/library'
import LoadingSpinner from '../components/ui/LoadingSpinner'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatETA(seconds: number): string {
  if (seconds <= 0 || seconds > 86400 * 7) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function DownloadsPage() {
  const { data, isLoading } = useDownloads()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to library
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Download className="w-6 h-6" />
          Downloads
        </h1>
        <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
          <span>{data?.active_count ?? 0} active</span>
          <span>{data?.completed_count ?? 0} completed</span>
          <span className="text-[var(--accent)]">{formatBytes(data?.total_dl_speed || 0)}/s</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size={40} />
        </div>
      ) : data?.items.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-12 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-[var(--green)]" />
          <h2 className="text-lg font-medium">No active downloads</h2>
          <p className="text-[var(--text-secondary)] mt-2">
            All your downloads are complete. Browse the catalog to add more games.
          </p>
          <Link
            to="/games"
            className="mt-4 inline-block px-6 py-2 bg-[var(--accent)] text-black rounded-lg font-medium hover:opacity-80 transition-opacity"
          >
            Browse Games
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.items.map((item, i) => {
            const isActive = item.status === 'downloading' || item.status === 'stalledDL' || item.status === 'metaDL'
            const isCompleted = item.progress >= 100

            return (
              <div
                key={i}
                className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4 hover:border-[var(--accent)]/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate mb-1">
                      {item.torrent_name}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                      <span className={`flex items-center gap-1 ${isActive ? 'text-[var(--accent)]' : isCompleted ? 'text-[var(--green)]' : ''}`}>
                        {isActive && <Loader2 className="w-3 h-3 animate-spin" />}
                        {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                        {!isActive && !isCompleted && <PauseCircle className="w-3 h-3" />}
                        <span className="capitalize">{item.status}</span>
                      </span>
                      <span>{formatBytes(item.size)}</span>
                      {item.game_id && (
                        <Link to={`/games/${item.game_id}`} className="text-[var(--accent)] hover:underline">
                          View game
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold">{item.progress.toFixed(1)}%</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {isActive && (
                        <>
                          {formatBytes(item.dlspeed)}/s · {formatETA(item.eta)}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${isCompleted ? 'bg-[var(--green)]' : 'bg-[var(--accent)]'}`}
                    style={{ width: `${Math.min(item.progress, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
