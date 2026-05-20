interface GameFiltersProps {
  sort: string
  onSortChange: (s: string) => void
  platform: string
  onPlatformChange: (p: string) => void
}

export default function GameFilters({ sort, onSortChange, platform, onPlatformChange }: GameFiltersProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <select
        value={sort}
        onChange={e => onSortChange(e.target.value)}
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer [&>option]:bg-[var(--bg-card)] [&>option]:text-[var(--text-primary)]"
      >
        <option value="date_desc">Newest First</option>
        <option value="date_asc">Oldest First</option>
        <option value="name_asc">Name A-Z</option>
        <option value="name_desc">Name Z-A</option>
        <option value="size_asc">Repack Size (Smallest)</option>
        <option value="size_desc">Repack Size (Largest)</option>
        <option value="metacritic">Metacritic Score</option>
        <option value="rating">IGDB Rating</option>
      </select>
      <select
        value={platform}
        onChange={e => onPlatformChange(e.target.value)}
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer [&>option]:bg-[var(--bg-card)] [&>option]:text-[var(--text-primary)]"
      >
        <option value="">All Platforms</option>
        <option value="windows">Windows</option>
        <option value="mac">Mac</option>
        <option value="linux">Linux</option>
      </select>
    </div>
  )
}
