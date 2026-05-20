interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const items: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) items.push(i)
  } else {
    items.push(1)
    if (page > 3) items.push('...')
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) items.push(i)
    if (page < totalPages - 2) items.push('...')
    items.push(totalPages)
  }

  return (
    <div className="flex items-center gap-1 justify-center mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--border)] transition-colors text-sm"
      >
        ← Prev
      </button>

      {items.map((item, i) =>
        item === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1 text-[var(--text-secondary)]">…</span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item as number)}
            className={`w-9 h-9 rounded text-sm transition-colors ${
              item === page
                ? 'bg-[var(--accent)] text-black font-medium'
                : 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--border)] hover:text-[var(--text-primary)]'
            }`}
          >
            {item}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--border)] transition-colors text-sm"
      >
        Next →
      </button>
    </div>
  )
}