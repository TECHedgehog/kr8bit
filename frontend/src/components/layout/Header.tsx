import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { Search, Library, Gamepad2, Settings2, Download } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useDownloads } from '../../api/library'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [searchVal, setSearchVal] = useState(searchParams.get('search') || '')
  const [showDownloads, setShowDownloads] = useState(false)
  const downloadsRef = useRef<HTMLDivElement>(null)
  const { data: downloads } = useDownloads()

  useEffect(() => {
    const s = searchParams.get('search') || ''
    setSearchVal(s)
  }, [searchParams])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (downloadsRef.current && !downloadsRef.current.contains(e.target as Node)) {
        setShowDownloads(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchVal.trim()) {
      if (location.pathname === '/games') {
        navigate(`/games?search=${encodeURIComponent(searchVal.trim())}`)
      } else {
        navigate(`/?search=${encodeURIComponent(searchVal.trim())}`)
      }
    } else {
      navigate(location.pathname === '/games' ? '/games' : '/')
    }
  }

  const activeCount = downloads?.active_count || 0

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-primary)] border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-[var(--accent)] font-bold text-lg shrink-0">
          <Library className="w-6 h-6" />
          <span className="hidden sm:inline">My Library</span>
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="Search games..."
              className="w-full pl-10 pr-4 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </form>

        <nav className="flex items-center gap-1">
          <Link to="/" className="p-2 rounded hover:bg-[var(--bg-card)] transition-colors" title="My Library">
            <Library className="w-5 h-5" />
          </Link>
          <Link to="/games" className="p-2 rounded hover:bg-[var(--bg-card)] transition-colors" title="Browse Games">
            <Gamepad2 className="w-5 h-5" />
          </Link>

          {/* Downloads dropdown */}
          <div className="relative" ref={downloadsRef}>
            <button
              onClick={() => setShowDownloads(!showDownloads)}
              className="p-2 rounded hover:bg-[var(--bg-card)] transition-colors relative"
              title="Downloads"
            >
              <Download className="w-5 h-5" />
              {activeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[var(--accent)] text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </button>

            {showDownloads && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden">
                <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
                  <span className="font-medium text-sm">Downloads</span>
                  {activeCount > 0 && (
                    <span className="text-xs text-[var(--accent)]">{activeCount} active</span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {downloads?.items && downloads.items.length > 0 ? (
                    downloads.items.slice(0, 10).map((item, i) => (
                      <div key={i} className="p-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-primary)]">
                        <div className="text-xs font-medium truncate mb-1">{item.torrent_name}</div>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                          <span className={`capitalize ${item.status === 'downloading' ? 'text-[var(--green)]' : ''}`}>
                            {item.status}
                          </span>
                          <span>{item.progress.toFixed(1)}%</span>
                          <span>{formatBytes(item.dlspeed)}/s</span>
                        </div>
                        <div className="mt-1.5 h-1 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--accent)] transition-all"
                            style={{ width: `${Math.min(item.progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-[var(--text-secondary)]">
                      No active downloads
                    </div>
                  )}
                </div>
                <Link
                  to="/downloads"
                  onClick={() => setShowDownloads(false)}
                  className="block p-2 text-center text-xs text-[var(--accent)] hover:bg-[var(--bg-primary)] border-t border-[var(--border)]"
                >
                  View all downloads
                </Link>
              </div>
            )}
          </div>

          <Link to="/settings" className="p-2 rounded hover:bg-[var(--bg-card)] transition-colors" title="Settings">
            <Settings2 className="w-5 h-5" />
          </Link>
        </nav>
      </div>
    </header>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}