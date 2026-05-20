import { useState } from 'react'
import { useCategories } from '../../api/categories'
import { useTags } from '../../api/tags'
import { useDownloadClientsStatus } from '../../api/downloadClients'
import {
  Server, Download, Upload, Tag as TagIcon, ChevronDown, ChevronUp,
} from 'lucide-react'

interface SidebarProps {
  selectedCategory?: number | null
  selectedTag?: number | null
  onCategoryChange: (id: number | null) => void
  onTagChange: (id: number | null) => void
}

export default function Sidebar({ selectedCategory, selectedTag, onCategoryChange, onTagChange }: SidebarProps) {
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
  const { data: status } = useDownloadClientsStatus()
  const [showClients, setShowClients] = useState(false)

  const popularTags = tags?.sort((a, b) => b.post_count - a.post_count).slice(0, 30)

  const anyConnected = status?.clients?.some(c => c.connected) ?? false
  const totalTorrents = status?.total_torrent_count ?? 0
  const totalActive = status?.total_active_count ?? 0
  const totalDlSpeed = status?.total_downloading_speed ?? 0

  return (
    <aside className="w-56 shrink-0 space-y-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
          Categories
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => { onCategoryChange(null); onTagChange(null) }}
            className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
              !selectedCategory && !selectedTag
                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
            }`}
          >
            All Games
          </button>
          {categories?.map(cat => (
            <button
              key={cat.id}
              onClick={() => { onCategoryChange(cat.id); onTagChange(null) }}
              className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
              }`}
            >
              <span className="truncate">{cat.name}</span>
              <span className="float-right text-xs opacity-50">{cat.post_count}</span>
            </button>
          ))}
        </div>
      </div>

      {popularTags && popularTags.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <TagIcon className="w-3 h-3" />
            Popular Tags
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {popularTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => {
                  if (selectedTag === tag.id) {
                    onTagChange(null)
                  } else {
                    onTagChange(tag.id)
                    onCategoryChange(null)
                  }
                }}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  selectedTag === tag.id
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/20'
                }`}
                title={`${tag.post_count} games`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Download Clients Aggregate Status */}
      {status && status.clients && status.clients.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <Server className="w-3 h-3" />
            Downloads
          </h3>
          <div className="bg-[var(--bg-card)] rounded-lg p-3 space-y-2 text-sm">
            {/* Aggregate */}
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Status</span>
              <span className={anyConnected ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                {anyConnected ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Torrents</span>
              <span>{totalTorrents}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)] flex items-center gap-1">
                <Download className="w-3 h-3" /> DL
              </span>
              <span>{totalActive}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)] flex items-center gap-1">
                <Upload className="w-3 h-3" /> Speed
              </span>
              <span>{totalDlSpeed ? `${(totalDlSpeed / 1024 / 1024).toFixed(1)} MB/s` : '0'}</span>
            </div>

            {/* Per-client expandable */}
            {status.clients.length > 1 && (
              <>
                <button
                  onClick={() => setShowClients(!showClients)}
                  className="w-full flex items-center justify-between text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] pt-1 border-t border-[var(--border)]"
                >
                  <span>{showClients ? 'Hide clients' : 'Show clients'}</span>
                  {showClients ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showClients && (
                  <div className="space-y-2 pt-1">
                    {status.clients.map(client => (
                      <div key={client.client_id} className="text-xs border-l-2 border-[var(--border)] pl-2">
                        <div className="flex items-center justify-between">
                          <span className="truncate" title={client.name}>{client.name}</span>
                          <span className={client.connected ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                            {client.connected ? '●' : '○'}
                          </span>
                        </div>
                        {client.connected && (
                          <div className="flex items-center justify-between text-[var(--text-secondary)]">
                            <span>{client.torrent_count} torrents</span>
                            <span>{client.active_count} active</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
