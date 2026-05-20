import { Library, Download, ScanLine, Loader2 } from 'lucide-react'
import { useLibraryStats, useScanLibrary } from '../../api/library'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function LibrarySection() {
  const { data: stats } = useLibraryStats()
  const scanMutation = useScanLibrary()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Library className="w-5 h-5" /> Library Configuration
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Manage your local game library settings.
        </p>
      </div>

      {/* Paths */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Paths</h3>
        <div className="text-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 flex items-center justify-between">
          <div>
            <div className="text-[var(--text-secondary)] text-xs">Library Path</div>
            <code className="text-xs">/library</code>
          </div>
          <Library className="w-4 h-4 text-[var(--text-secondary)]" />
        </div>
        <div className="text-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 flex items-center justify-between">
          <div>
            <div className="text-[var(--text-secondary)] text-xs">Downloads Path</div>
            <code className="text-xs">/downloads</code>
          </div>
          <Download className="w-4 h-4 text-[var(--text-secondary)]" />
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          These paths are configured via Docker volume mounts. Update your docker-compose.yml to change them.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Library Stats</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total_user_games}</div>
              <div className="text-xs text-[var(--text-secondary)]">Games</div>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{formatBytes(stats.total_size)}</div>
              <div className="text-xs text-[var(--text-secondary)]">Total Size</div>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-[var(--accent)]">{stats.downloading_count}</div>
              <div className="text-xs text-[var(--text-secondary)]">Downloading</div>
            </div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-[var(--green)]">{stats.matched_count}</div>
              <div className="text-xs text-[var(--text-secondary)]">Matched</div>
            </div>
          </div>
        </div>
      )}

      {/* Scan button */}
      <div className="pt-4 border-t border-[var(--border)]">
        <button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="w-full px-4 py-2.5 bg-[var(--accent)] text-black rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {scanMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ScanLine className="w-4 h-4" />
          )}
          {scanMutation.isPending ? 'Scanning...' : 'Scan Library Now'}
        </button>
        {scanMutation.isSuccess && (
          <p className="text-sm text-[var(--green)] mt-2 text-center">
            Scanned {scanMutation.data.library_scanned} library entries and {scanMutation.data.downloads_scanned} downloads
          </p>
        )}
      </div>
    </div>
  )
}
