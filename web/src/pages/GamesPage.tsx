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
import { api, ApiError } from '../api/client';
import type { GameListResult } from '../api/types';
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

const LIMIT_OPTIONS = [10, 25, 50, 100];

const GRID_SIZES = [
  { label: 'Small', value: 130, iconSize: 10 },
  { label: 'Medium', value: 160, iconSize: 12 },
  { label: 'Large', value: 190, iconSize: 15 },
];
const GRID_SIZE_DEFAULT = 160;

export function GamesPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();

  const sort = (searchParams.get('sort') as SortKey) ?? 'title-asc';
  const search = searchParams.get('search') ?? '';
  const limit = Number(searchParams.get('limit') ?? 25);
  const offset = Number(searchParams.get('offset') ?? 0);
  const gridSize = Number(searchParams.get('gridSize') ?? GRID_SIZE_DEFAULT);

  const [searchInput, setSearchInput] = useState(search);
  const [searchExpanded, setSearchExpanded] = useState(search !== '');
  const [data, setData] = useState<GameListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState<Panel>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  useTiltGlow(searchRef);
  const gridSizeToggleRef = useRef<HTMLDivElement>(null);
  useGlowFollow(gridSizeToggleRef);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
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
  }, [search, limit, offset]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

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
  }

  function onLimitChange(value: number) {
    updateParams({ limit: value, offset: 0 });
  }

  function onGridSizeChange(value: number) {
    updateParams({ gridSize: value });
  }

  function togglePanel(panel: 'advanced' | 'settings') {
    setPanelOpen((current) => (current === panel ? null : panel));
  }

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const hasPrev = offset > 0;
  const hasNext = offset + items.length < total;

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
      {loading && !data && <div className="muted">Loading…</div>}

      {!loading && !error && items.length === 0 && (
        <div className="muted">No games found</div>
      )}

      <div className="game-grid" style={{ '--grid-min-size': `${gridSize}px` } as React.CSSProperties}>
        {items.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>

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
