import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, Outlet } from 'react-router-dom';
import { useTiltGlow } from '../hooks/useTiltGlow';
import { useGlowFollow } from '../hooks/useGlowFollow';
import { useSliderIndicator } from '../hooks/useSliderIndicator';
import IconSearch from '@tabler/icons-react/dist/esm/icons/IconSearch.mjs';
import IconGrid3x3 from '@tabler/icons-react/dist/esm/icons/IconGrid3x3.mjs';
import IconList from '@tabler/icons-react/dist/esm/icons/IconList.mjs';
import IconArrowsUpDown from '@tabler/icons-react/dist/esm/icons/IconArrowsUpDown.mjs';
import IconFilter from '@tabler/icons-react/dist/esm/icons/IconFilter.mjs';
import IconScan from '@tabler/icons-react/dist/esm/icons/IconScan.mjs';
import IconSortAZ from '@tabler/icons-react/dist/esm/icons/IconSortAZ.mjs';
import IconSortZA from '@tabler/icons-react/dist/esm/icons/IconSortZA.mjs';
import IconCalendarClock from '@tabler/icons-react/dist/esm/icons/IconCalendarClock.mjs';
import IconCalendarMonth from '@tabler/icons-react/dist/esm/icons/IconCalendarMonth.mjs';
import IconDatabase from '@tabler/icons-react/dist/esm/icons/IconDatabase.mjs';
import IconDatabaseExport from '@tabler/icons-react/dist/esm/icons/IconDatabaseExport.mjs';
import IconCheck from '@tabler/icons-react/dist/esm/icons/IconCheck.mjs';
import IconSquareFilled from '@tabler/icons-react/dist/esm/icons/IconSquareFilled.mjs';
import { api, ApiError } from '../api/client';
import type { GameListResult, MatchStatus } from '../api/types';
import { GameCard } from '../components/GameCard';
import { GameListRow } from '../components/GameListRow';
import { IconButton } from '../components/IconButton';


type ViewMode = 'grid' | 'list';
type SortKey = 'title-asc' | 'title-desc' | 'newest' | 'oldest' | 'largest' | 'smallest';
type StatusFilter = '' | MatchStatus;

const SORT_OPTIONS: Array<{ value: SortKey; label: string; icon: typeof IconSortAZ }> = [
  { value: 'title-asc', label: 'Title A-Z', icon: IconSortAZ },
  { value: 'title-desc', label: 'Title Z-A', icon: IconSortZA },
  { value: 'newest', label: 'Newest first', icon: IconCalendarClock },
  { value: 'oldest', label: 'Oldest first', icon: IconCalendarMonth },
  { value: 'largest', label: 'Largest first', icon: IconDatabase },
  { value: 'smallest', label: 'Smallest first', icon: IconDatabaseExport },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FLAGGED', label: 'Flagged' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'REJECTED', label: 'Rejected' },
];

const LIMIT_OPTIONS = [10, 25, 50, 100];

const GRID_SIZES = [
  { label: 'Small', value: 150, iconSize: 10 },
  { label: 'Medium', value: 170, iconSize: 12 },
  { label: 'Large', value: 200, iconSize: 15 },
];
const GRID_SIZE_DEFAULT = 170;

export function GamesPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();

  const view = (searchParams.get('view') as ViewMode) ?? 'grid';
  const sort = (searchParams.get('sort') as SortKey) ?? 'title-asc';
  const status = (searchParams.get('status') as StatusFilter) ?? '';
  const search = searchParams.get('search') ?? '';
  const limit = Number(searchParams.get('limit') ?? 25);
  const offset = Number(searchParams.get('offset') ?? 0);
  const gridSize = Number(searchParams.get('gridSize') ?? GRID_SIZE_DEFAULT);

  const [searchInput, setSearchInput] = useState(search);
  const [searchExpanded, setSearchExpanded] = useState(search !== '');
  const [data, setData] = useState<GameListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  useTiltGlow(searchRef);
  const viewToggleRef = useRef<HTMLDivElement>(null);
  useGlowFollow(viewToggleRef);
  const viewToggleIndicatorRef = useRef<HTMLDivElement>(null);
  const viewIndicator = useSliderIndicator({
    toggleRef: viewToggleRef,
    indicatorRef: viewToggleIndicatorRef,
    activeSelector: '.icon-button.active',
    dep: view,
  });

  const gridSizeToggleRef = useRef<HTMLDivElement>(null);
  useGlowFollow(gridSizeToggleRef, view === 'grid');
  const gridSizeIndicatorRef = useRef<HTMLDivElement>(null);
  const gridSizeIndicator = useSliderIndicator({
    toggleRef: gridSizeToggleRef,
    indicatorRef: gridSizeIndicatorRef,
    activeSelector: '.size-button.active',
    dep: gridSize,
  });

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const res = await api.get<GameListResult>(`/api/games?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'failed to load games');
    } finally {
      setLoading(false);
    }
  }, [status, search, limit, offset]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function updateParams(updates: Record<string, string | number>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === '' || value === 0) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    }
    setSearchParams(next);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ search: searchInput.trim(), offset: 0 });
  }

  function onSortChange(key: SortKey) {
    updateParams({ sort: key, offset: 0 });
    setSortOpen(false);
  }

  function onStatusChange(value: StatusFilter) {
    updateParams({ status: value, offset: 0 });
    setFilterOpen(false);
  }

  function onViewChange(mode: ViewMode) {
    updateParams({ view: mode });
  }

  function onLimitChange(value: number) {
    updateParams({ limit: value, offset: 0 });
  }

  function onGridSizeChange(value: number) {
    updateParams({ gridSize: value });
  }

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const hasPrev = offset > 0;
  const hasNext = offset + items.length < total;
  const currentSort = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];

  return (
    <div className="page">
      <div className="library-header">
        <div>
          <div className="library-title">Library</div>
          <div className="library-subtitle">{total} {total === 1 ? 'game' : 'games'}</div>
        </div>

        <div className="library-toolbar">
          <form
            ref={searchRef}
            className={`library-search tilt-glow${searchExpanded ? ' is-expanded' : ''}`}
            onSubmit={onSearchSubmit}
            onClick={() => {
              const input = searchRef.current?.querySelector('input');
              input?.focus();
            }}
          >
            <IconSearch size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setSearchExpanded(true)}
              onBlur={() => { if (!searchInput.trim()) setSearchExpanded(false); }}
              placeholder={searchExpanded ? 'Search title or entry name…' : 'Search'}
            />
          </form>

          <div className="toolbar-spacer" />

          <div className="filter-menu" ref={filterRef}>
            <IconButton
              icon={IconFilter}
              label="Filter by status"
              active={status !== ''}
              onClick={() => setFilterOpen((v) => !v)}
              glow
            />
            {filterOpen && (
              <div className="filter-menu-dropdown">
                {STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    className={`filter-menu-item${status === o.value ? ' active' : ''}`}
                    onClick={() => onStatusChange(o.value)}
                  >
                    {o.label}
                    {status === o.value && <IconCheck size={14} style={{ marginLeft: 'auto' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="sort-menu" ref={sortRef}>
            <IconButton
              icon={IconArrowsUpDown}
              label={`Sort: ${currentSort.label}`}
              onClick={() => setSortOpen((v) => !v)}
              glow
            />
            {sortOpen && (
              <div className="sort-menu-dropdown">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    className={`sort-menu-item${sort === o.value ? ' active' : ''}`}
                    onClick={() => onSortChange(o.value)}
                  >
                    {o.label}
                    {sort === o.value && <IconCheck size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link to="/scan">
            <IconButton icon={IconScan} label="Go to scanner" glow />
          </Link>

          <div className="toolbar-divider" />

          {view === 'grid' && (
            <div className="grid-size-toggle glow-follow" ref={gridSizeToggleRef}>
              <div
                ref={gridSizeIndicatorRef}
                className={`view-toggle-indicator${gridSizeIndicator.suppressTransition ? ' view-toggle-indicator--no-transition' : ''}`}
                style={gridSizeIndicator.indicatorStyle}
                onAnimationEnd={gridSizeIndicator.onAnimationEnd}
              />
              {GRID_SIZES.map((s) => (
                <button
                  key={s.value}
                  className={`size-button${gridSize === s.value ? ' active' : ''}`}
                  onClick={() => onGridSizeChange(s.value)}
                  title={s.label}
                >
                  <IconSquareFilled size={s.iconSize}/>
                </button>
              ))}
            </div>
          )}

          <div className="view-toggle glow-follow" ref={viewToggleRef}>
            <div
              ref={viewToggleIndicatorRef}
              className={`view-toggle-indicator${viewIndicator.suppressTransition ? ' view-toggle-indicator--no-transition' : ''}`}
              style={viewIndicator.indicatorStyle}
              onAnimationEnd={viewIndicator.onAnimationEnd}
            />
            <IconButton
              icon={IconGrid3x3}
              label="Grid view"
              active={view === 'grid'}
              ghost
              onClick={() => onViewChange('grid')}
            />
            <IconButton
              icon={IconList}
              label="List view"
              active={view === 'list'}
              ghost
              onClick={() => onViewChange('list')}
            />
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {loading && !data && <div className="muted">Loading…</div>}

      {!loading && !error && items.length === 0 && (
        <div className="muted">No games found</div>
      )}

      {view === 'grid' ? (
        <div className="game-grid" style={{ '--grid-min-size': `${gridSize}px` } as React.CSSProperties}>
          {items.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      ) : (
        <div className="game-list">
          {items.map((g) => (
            <GameListRow key={g.id} game={g} />
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="pagination">
          <button
            disabled={!hasPrev}
            onClick={() => updateParams({ offset: Math.max(0, offset - limit) })}
          >
            Prev
          </button>
          <span className="pagination-info">
            {offset + 1}–{offset + items.length} of {total}
          </span>
          <button
            disabled={!hasNext}
            onClick={() => updateParams({ offset: offset + limit })}
          >
            Next
          </button>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            style={{ width: 'auto' }}
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
        </div>
      )}

      <Outlet />
    </div>
  );
}