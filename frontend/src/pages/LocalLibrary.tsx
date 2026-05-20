import { Link, useSearchParams } from 'react-router-dom'
import {
  Library, Gamepad2, HardDrive, Search,
  ScanLine, Loader2,
  CheckCircle2,
} from 'lucide-react'
import { useLibrary, useLibraryStats, useScanLibrary } from '../api/library'
import { useDebounce } from '../hooks/useDebounce'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import type { LocalLibraryEntry } from '../types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function LocalGameCard({ entry }: { entry: LocalLibraryEntry }) {
  const imgSrc = entry.sgdb_grid_url || entry.capsule_image || entry.header_image || ''
  const isDownloading = entry.download_status === 'downloading'
  const hasEnrichment = entry.enrichment?.igdb === 'matched' || entry.enrichment?.steam === 'matched' || entry.igdb_id

  return (
    <Link
      to={`/library/${entry.id}`}
      className="block bg-[var(--bg-card)] rounded-lg overflow-hidden border border-[var(--border)] hover:border-[var(--accent)]/40 transition-all hover:shadow-lg hover:shadow-[var(--accent)]/5 group"
    >
      <div className="aspect-[3/4] bg-[var(--bg-secondary)] relative overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={entry.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            <Gamepad2 className="w-10 h-10" />
          </div>
        )}
        {/* Status badges */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {entry.game_id && (
            <div className="bg-[var(--green)]/80 rounded px-1.5 py-0.5 text-[10px] font-bold text-white flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              FitGirl
            </div>
          )}
          {!entry.is_available && (
            <div className="bg-[var(--red)]/80 rounded px-1.5 py-0.5 text-[10px] font-bold text-white">
              Missing
            </div>
          )}
        </div>
        {isDownloading && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
            <div className="flex items-center justify-between text-[10px] text-white mb-0.5">
              <span>Downloading</span>
              <span>{(entry.download_progress * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all"
                style={{ width: `${entry.download_progress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium leading-tight mb-1 line-clamp-2" title={entry.title}>
          {entry.title || entry.name}
        </h3>
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-2">
          <span className="capitalize">{entry.format}</span>
          <span>{formatBytes(entry.folder_size)}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasEnrichment && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)]">
              {entry.enrichment?.igdb === 'matched' ? 'IGDB' : entry.enrichment?.steam === 'matched' ? 'Steam' : 'Matched'}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function LocalLibrary() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '1', 10)
  const search = searchParams.get('search') || ''
  const format = searchParams.get('format') || ''
  const matched = searchParams.get('matched')
  const available = searchParams.get('available')
  const sort = searchParams.get('sort') || 'date_desc'

  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useLibrary({
    page,
    per_page: 48,
    search: debouncedSearch || undefined,
    format: format || undefined,
    matched: matched === 'true' ? true : matched === 'false' ? false : undefined,
    available: available === 'true' ? true : available === 'false' ? false : undefined,
    sort,
  })

  const { data: stats } = useLibraryStats()
  const scanMutation = useScanLibrary()

  const setParam = (key: string, val: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (val === null || val === '' || val === 'date_desc') {
      next.delete(key)
    } else {
      next.set(key, val)
    }
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 hidden lg:block space-y-4">
        {/* Stats */}
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Library className="w-4 h-4" /> Library Stats
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[var(--bg-primary)] rounded p-2">
              <div className="text-[var(--text-secondary)]">Games</div>
              <div className="text-lg font-bold">{stats?.total_user_games ?? '-'}</div>
            </div>
            <div className="bg-[var(--bg-primary)] rounded p-2">
              <div className="text-[var(--text-secondary)]">Size</div>
              <div className="text-lg font-bold">{stats ? formatBytes(stats.total_size) : '-'}</div>
            </div>
            <div className="bg-[var(--bg-primary)] rounded p-2">
              <div className="text-[var(--text-secondary)]">Downloading</div>
              <div className="text-lg font-bold text-[var(--accent)]">{stats?.downloading_count ?? '-'}</div>
            </div>
            <div className="bg-[var(--bg-primary)] rounded p-2">
              <div className="text-[var(--text-secondary)]">Matched</div>
              <div className="text-lg font-bold text-[var(--green)]">{stats?.matched_count ?? '-'}</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4 space-y-3">
          <h2 className="text-sm font-semibold">Filters</h2>

          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Format</label>
            <select
              value={format}
              onChange={e => setParam('format', e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-sm"
            >
              <option value="">All formats</option>
              <option value="installer">Installer</option>
              <option value="installed">Installed</option>
              <option value="archive">Archive</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Matched to FitGirl</label>
            <select
              value={matched || ''}
              onChange={e => setParam('matched', e.target.value || null)}
              className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-sm"
            >
              <option value="">All</option>
              <option value="true">Matched</option>
              <option value="false">Unmatched</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Availability</label>
            <select
              value={available || ''}
              onChange={e => setParam('available', e.target.value || null)}
              className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-sm"
            >
              <option value="">All</option>
              <option value="true">Available</option>
              <option value="false">Missing</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Sort</label>
            <select
              value={sort}
              onChange={e => setParam('sort', e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-sm"
            >
              <option value="date_desc">Recently added</option>
              <option value="date_asc">Oldest first</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="size_desc">Largest first</option>
              <option value="size_asc">Smallest first</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="w-full px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {scanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
          Scan Library
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Library className="w-6 h-6" />
            My Library
            {data && (
              <span className="text-sm font-normal text-[var(--text-secondary)]">
                ({data.total} games)
              </span>
            )}
          </h1>

          {/* Mobile scan button */}
          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="lg:hidden px-3 py-1.5 bg-[var(--accent)] text-black rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
          >
            {scanMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanLine className="w-3 h-3" />}
            Scan
          </button>
        </div>

        {/* Search bar (mobile) */}
        <div className="lg:hidden mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={e => setParam('search', e.target.value)}
              placeholder="Search your library..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size={40} />
          </div>
        ) : data?.items.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-12 text-center">
            <HardDrive className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)]" />
            <h2 className="text-lg font-medium mb-2">Your library is empty</h2>
            <p className="text-[var(--text-secondary)] mb-4 max-w-md mx-auto">
              Games you download from the catalog will appear here automatically. You can also scan an existing folder.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => scanMutation.mutate()}
                className="px-6 py-2 bg-[var(--accent)] text-black rounded-lg font-medium hover:opacity-80 transition-opacity flex items-center gap-2"
              >
                <ScanLine className="w-4 h-4" />
                Scan Library
              </button>
              <Link
                to="/games"
                className="px-6 py-2 border border-[var(--border)] rounded-lg font-medium hover:bg-[var(--bg-card)] transition-colors flex items-center gap-2"
              >
                <Gamepad2 className="w-4 h-4" />
                Browse Games
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {data?.items.map(entry => (
                <LocalGameCard key={entry.id} entry={entry} />
              ))}
            </div>

            {data && (
              <Pagination
                page={page}
                totalPages={data.total_pages}
                onPageChange={(p) => setParam('page', p.toString())}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
