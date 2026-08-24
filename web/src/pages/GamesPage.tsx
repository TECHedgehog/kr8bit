import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Outlet } from 'react-router-dom';
import { useTiltGlow } from '../hooks/useTiltGlow';
import { useGlowFollow } from '../hooks/useGlowFollow';
import IconSearch from '@tabler/icons-react/dist/esm/icons/IconSearch.mjs';
import IconAdjustments from '@tabler/icons-react/dist/esm/icons/IconAdjustments.mjs';
import IconSettings from '@tabler/icons-react/dist/esm/icons/IconSettings.mjs';
import IconSortAZ from '@tabler/icons-react/dist/esm/icons/IconSortAZ.mjs';
import IconSortZA from '@tabler/icons-react/dist/esm/icons/IconSortZA.mjs';
import IconCalendarClock from '@tabler/icons-react/dist/esm/icons/IconCalendarClock.mjs';
import IconCalendarMonth from '@tabler/icons-react/dist/esm/icons/IconCalendarMonth.mjs';
import IconDatabase from '@tabler/icons-react/dist/esm/icons/IconDatabase.mjs';
import IconDatabaseExport from '@tabler/icons-react/dist/esm/icons/IconDatabaseExport.mjs';
import IconSquareFilled from '@tabler/icons-react/dist/esm/icons/IconSquareFilled.mjs';
import IconArrowUp from '@tabler/icons-react/dist/esm/icons/IconArrowUp.mjs';
import { api, ApiError } from '../api/client';
import type { Game, GameListResult } from '../api/types';
import { GameCard } from '../components/GameCard';
import { IconButton } from '../components/IconButton';


type SortKey = 'title-asc' | 'title-desc' | 'newest' | 'oldest' | 'largest' | 'smallest';
type Panel = 'advanced' | 'settings' | null;

const SORT_OPTIONS: Array<{ value: SortKey; label: string; icon: typeof IconSortAZ }> = [
  { value: 'title-asc', label: 'Title A-Z', icon: IconSortAZ },
  { value: 'title-desc', label: 'Title Z-A', icon: IconSortZA },
  { value: 'newest', label: 'Newest first', icon: IconCalendarClock },
  { value: 'oldest', label: 'Oldest first', icon: IconCalendarMonth },
  { value: 'largest', label: 'Largest first', icon: IconDatabase },
  { value: 'smallest', label: 'Smallest first', icon: IconDatabaseExport },
];

const GRID_SIZES = [
  { label: 'Small', value: 130, iconSize: 10 },
  { label: 'Medium', value: 160, iconSize: 12 },
  { label: 'Large', value: 190, iconSize: 15 },
];
const GRID_SIZE_DEFAULT = 160;

// Chunk size for infinite scroll. Backend caps limit at 200.
const PAGE_SIZE = 50;

export function GamesPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();

  const sort = (searchParams.get('sort') as SortKey) ?? 'title-asc';
  const search = searchParams.get('search') ?? '';
  const gridSize = Number(searchParams.get('gridSize') ?? GRID_SIZE_DEFAULT);

  const [searchInput, setSearchInput] = useState(search);
  const [searchExpanded, setSearchExpanded] = useState(search !== '');
  const [items, setItems] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState<Panel>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  useTiltGlow(searchRef);
  const gridSizeToggleRef = useRef<HTMLDivElement>(null);
  useGlowFollow(gridSizeToggleRef);
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef<HTMLButtonElement>(null);
  useGlowFollow(scrollTopRef);

  // Request token: incremented on each reset so stale fetchMore responses
  // (from a superseded filter) are ignored before appending.
  const reqToken = useRef(0);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const fetchInitial = useCallback(async () => {
    const token = ++reqToken.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', '0');
      const res = await api.get<GameListResult>(`/api/games?${params.toString()}`);
      if (reqToken.current !== token) return; // superseded
      setItems(res.items);
      setTotal(res.total);
      setHasMore(res.items.length < res.total);
    } catch (err) {
      if (reqToken.current !== token) return;
      setError(err instanceof ApiError ? err.message : 'failed to load games');
    } finally {
      if (reqToken.current === token) setLoading(false);
    }
  }, [search]);

  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const token = reqToken.current;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(items.length));
      const res = await api.get<GameListResult>(`/api/games?${params.toString()}`);
      if (reqToken.current !== token) return; // superseded by a reset
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(items.length + res.items.length < res.total);
    } catch (err) {
      if (reqToken.current !== token) return;
      setError(err instanceof ApiError ? err.message : 'failed to load more games');
    } finally {
      if (reqToken.current === token) setLoadingMore(false);
    }
  }, [search, items.length, loadingMore, hasMore]);

  // Reset + initial fetch whenever filters change.
  useEffect(() => {
    void fetchInitial();
  }, [fetchInitial]);

  // Infinite scroll: observe sentinel, load next chunk when it enters view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchMore();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchMore]);

  // Scroll-to-top visibility: show once the first row of games scrolls out
  // the top of the viewport. The first card shares top+height with all
  // first-row cards in a CSS grid, so its bottom < 0 means the row is gone.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const firstCard = grid.firstElementChild as HTMLElement | null;
    if (!firstCard) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowScrollTop(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
      },
      { threshold: 0 },
    );
    observer.observe(firstCard);
    return () => observer.disconnect();
  }, [items]);

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
    updateParams({ search: searchInput.trim() });
  }

  function onSortChange(key: SortKey) {
    updateParams({ sort: key });
  }

  function onGridSizeChange(value: number) {
    updateParams({ gridSize: value });
  }

  function togglePanel(panel: 'advanced' | 'settings') {
    setPanelOpen((current) => (current === panel ? null : panel));
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="page">
      <div className="library-header">
        <div className="library-toolbar">
          <div className="library-title-block">
            <div className="library-title">Library</div>
            <div className="library-subtitle">{total} {total === 1 ? 'game' : 'games'}</div>
          </div>

          <div className="toolbar-spacer" />

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

          <IconButton
            icon={IconAdjustments}
            label="Advanced search"
            active={panelOpen === 'advanced'}
            onClick={() => togglePanel('advanced')}
            glow
          />

          <IconButton
            icon={IconSettings}
            label="Settings"
            active={panelOpen === 'settings'}
            onClick={() => togglePanel('settings')}
            glow
          />
        </div>

        {panelOpen === 'advanced' && (
          <div className="library-panel">
            <div className="panel-group">
              <span className="panel-label">Sort</span>
              <div className="panel-chips">
                {SORT_OPTIONS.map((o) => {
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.value}
                      className={`panel-chip${sort === o.value ? ' active' : ''}`}
                      onClick={() => onSortChange(o.value)}
                    >
                      <Icon size={14} />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {panelOpen === 'settings' && (
          <div className="library-panel">
            <div className="panel-group">
              <span className="panel-label">Grid size</span>
              <div className="grid-size-toggle glow-follow" ref={gridSizeToggleRef}>
                <div className="view-toggle-lens">
                  {GRID_SIZES.map((s) => (
                    <button
                      key={s.value}
                      className={`size-button${gridSize === s.value ? ' active' : ''}`}
                      onClick={() => onGridSizeChange(s.value)}
                      title={s.label}
                    >
                      <IconSquareFilled size={s.iconSize} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}
      {loading && items.length === 0 && <div className="muted">Loading…</div>}

      {!loading && !error && items.length === 0 && (
        <div className="muted">No games found</div>
      )}

      <div
        ref={gridRef}
        className="game-grid"
        style={{ '--grid-min-size': `${gridSize}px` } as React.CSSProperties}
      >
        {items.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>

      {loadingMore && <div className="muted">Loading more…</div>}

      <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />

      <button
        ref={scrollTopRef}
        className={`topbar-pill scroll-top-pill glow-follow${showScrollTop ? ' is-visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Scroll to top"
        type="button"
      >
        <IconArrowUp size={20} />
      </button>

      <Outlet />
    </div>
  );
}
