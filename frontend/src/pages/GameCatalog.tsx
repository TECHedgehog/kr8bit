import { useSearchParams } from 'react-router-dom'
import { useGames } from '../api/games'
import Sidebar from '../components/layout/Sidebar'
import GameGrid from '../components/games/GameGrid'
import GameFilters from '../components/games/GameFilters'
import Pagination from '../components/ui/Pagination'
import { useDebounce } from '../hooks/useDebounce'

export default function GameCatalog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '1', 10)
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') ? parseInt(searchParams.get('category')!) : undefined
  const tag = searchParams.get('tag') ? parseInt(searchParams.get('tag')!) : undefined
  const sort = searchParams.get('sort') || 'date_desc'
  const platform = searchParams.get('platform') || ''

  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useGames({ page, per_page: 48, search: debouncedSearch || undefined, category, tag, sort, platform })

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
      <Sidebar
        selectedCategory={category ?? null}
        selectedTag={tag ?? null}
        onCategoryChange={(id) => setParam('category', id?.toString() ?? null)}
        onTagChange={(id) => setParam('tag', id?.toString() ?? null)}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">
            {search ? `Search: "${search}"` : 'Games'}
            {data && <span className="text-sm font-normal text-[var(--text-secondary)] ml-2">({data.total} results)</span>}
          </h1>
        </div>

        <GameFilters
          sort={sort}
          onSortChange={(v) => setParam('sort', v)}
          platform={platform}
          onPlatformChange={(v) => setParam('platform', v)}
        />

        <GameGrid games={data?.items} isLoading={isLoading} />

        {data && (
          <Pagination
            page={page}
            totalPages={data.total_pages}
            onPageChange={(p) => setParam('page', p.toString())}
          />
        )}
      </div>
    </div>
  )
}
