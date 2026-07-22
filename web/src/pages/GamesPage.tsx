import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search, Grid3x3, List, ArrowDownUp, Filter, ScanLine,
  ArrowDownAZ, ArrowUpAZ, CalendarClock, CalendarDays,
  HardDrive, HardDriveDownload, Check,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { GameListResult, MatchStatus } from '../api/types';
import { GameCard } from '../components/GameCard';
import { GameListRow } from '../components/GameListRow';
import { IconButton } from '../components/IconButton';


type ViewMode = 'grid' | 'list';
type SortKey = 'title-asc' | 'title-desc' | 'newest' | 'oldest' | 'largest' | 'smallest';
type StatusFilter = '' | MatchStatus;

const SORT_OPTIONS: Array<{ value: SortKey; label: string; icon: typeof ArrowDownAZ }> = [
  { value: 'title-asc', label: 'Title A-Z', icon: ArrowDownAZ },
  { value: 'title-desc', label: 'Title Z-A', icon: ArrowUpAZ },
  { value: 'newest', label: 'Newest first', icon: CalendarClock },
  { value: 'oldest', label: 'Oldest first', icon: CalendarDays },
  { value: 'largest', label: 'Largest first', icon: HardDrive },
  { value: 'smallest', label: 'Smallest first', icon: HardDriveDownload },
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

export function GamesPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();

  const view = (searchParams.get('view') as ViewMode) ?? 'grid';
  const sort = (searchParams.get('sort') as SortKey) ?? 'title-asc';
  const status = (searchParams.get('status') as StatusFilter) ?? '';
  const search = searchParams.get('search') ?? '';
  const limit = Number(searchParams.get('limit') ?? 25);
  const offset = Number(searchParams.get('offset') ?? 0);

  const [searchInput, setSearchInput] = useState(search);
  const [data, setData] = useState<GameListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const viewToggleRef = useRef<HTMLDivElement>(null);
  const viewToggleIndicatorRef = useRef<HTMLDivElement>(null);
  const viewIsFirstRender = useRef(true);
  const [viewSuppressTransition, setViewSuppressTransition] = useState(true);
  const [viewIndicatorStyle, setViewIndicatorStyle] = useState<{ translate: string; width: string; opacity: number }>({
    translate: '0px 0',
    width: '0px',
    opacity: 0,
  });

  useLayoutEffect(() => {
    const toggle = viewToggleRef.current;
    if (!toggle) return;
    const activeBtn = toggle.querySelector('.icon-button.active') as HTMLElement | null;
    if (!activeBtn) {
      setViewIndicatorStyle((s) => ({ ...s, opacity: 0 }));
      return;
    }
    const toggleRect = toggle.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const x = btnRect.left - toggleRect.left;
    setViewIndicatorStyle({
      translate: `${x}px 0`,
      width: `${btnRect.width}px`,
      opacity: 1,
    });

    if (viewIsFirstRender.current) {
      viewIsFirstRender.current = false;
      return;
    }

    const el = viewToggleIndicatorRef.current;
    if (el) {
      el.classList.remove('view-toggle-indicator--moving');
      void el.offsetWidth;
      el.classList.add('view-toggle-indicator--moving');
    }
  }, [view]);

  useEffect(() => {
    requestAnimationFrame(() => setViewSuppressTransition(false));
  }, []);

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
          <form className="library-search" onSubmit={onSearchSubmit}>
            <Search size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title or entry name…"
            />
          </form>

          <div className="toolbar-spacer" />

          <div className="filter-menu" ref={filterRef}>
            <IconButton
              icon={Filter}
              label="Filter by status"
              active={status !== ''}
              onClick={() => setFilterOpen((v) => !v)}
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
                    {status === o.value && <Check size={14} style={{ marginLeft: 'auto' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="sort-menu" ref={sortRef}>
            <IconButton
              icon={ArrowDownUp}
              label={`Sort: ${currentSort.label}`}
              onClick={() => setSortOpen((v) => !v)}
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
                    {sort === o.value && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link to="/scan">
            <IconButton icon={ScanLine} label="Go to scanner" />
          </Link>

          <div className="toolbar-divider" />

          <div className="view-toggle" ref={viewToggleRef}>
            <div
              ref={viewToggleIndicatorRef}
              className={`view-toggle-indicator${viewSuppressTransition ? ' view-toggle-indicator--no-transition' : ''}`}
              style={viewIndicatorStyle}
              onAnimationEnd={() => viewToggleIndicatorRef.current?.classList.remove('view-toggle-indicator--moving')}
            />
            <IconButton
              icon={Grid3x3}
              label="Grid view"
              active={view === 'grid'}
              ghost
              onClick={() => onViewChange('grid')}
            />
            <IconButton
              icon={List}
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
        <div className="game-grid">
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
    </div>
  );
}