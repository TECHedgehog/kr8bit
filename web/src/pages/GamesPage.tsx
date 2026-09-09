import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Outlet } from 'react-router-dom';
import { useTiltGlow } from '../hooks/useTiltGlow';
import { useGlowFollow } from '../hooks/useGlowFollow';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useGridFlip } from '../hooks/useGridFlip';
import { useVirtualGrid } from '../hooks/useVirtualGrid';
import { useRevealRows } from '../hooks/useRevealRows';
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
import IconCircleCheckFilled from '@tabler/icons-react/dist/esm/icons/IconCircleCheckFilled.mjs';
import IconCircleXFilled from '@tabler/icons-react/dist/esm/icons/IconCircleXFilled.mjs';
import IconCircleCaretRightFilled from '@tabler/icons-react/dist/esm/icons/IconCircleCaretRightFilled.mjs';
import IconHelpCircleFilled from '@tabler/icons-react/dist/esm/icons/IconHelpCircleFilled.mjs';
import { api, ApiError } from '../api/client';
import type { Game, GameListResult, GenresResult, SortKey } from '../api/types';
import { GameCard } from '../components/GameCard';
import { IconButton } from '../components/IconButton';


type Panel = 'advanced' | 'settings' | null;

const SORT_OPTIONS: Array<{ value: SortKey; label: string; icon: typeof IconSortAZ }> = [
  { value: 'title-asc', label: 'Title A-Z', icon: IconSortAZ },
  { value: 'title-desc', label: 'Title Z-A', icon: IconSortZA },
  { value: 'newest', label: 'Newest first', icon: IconCalendarClock },
  { value: 'oldest', label: 'Oldest first', icon: IconCalendarMonth },
  { value: 'largest', label: 'Largest first', icon: IconDatabase },
  { value: 'smallest', label: 'Smallest first', icon: IconDatabaseExport },
];

const DECK_OPTIONS: Array<{ value: number; label: string; icon: typeof IconCircleCheckFilled }> = [
  { value: 3, label: 'Verified', icon: IconCircleCheckFilled },
  { value: 2, label: 'Playable', icon: IconCircleCaretRightFilled },
  { value: 1, label: 'Unsupported', icon: IconCircleXFilled },
  { value: 0, label: 'Unknown', icon: IconHelpCircleFilled },
];

const GRID_SIZES = [
  { label: 'Small', value: 130, iconSize: 10 },
  { label: 'Medium', value: 160, iconSize: 12 },
  { label: 'Large', value: 190, iconSize: 15 },
];
const GRID_SIZE_DEFAULT = 160;

// Chunk size for infinite scroll. Backend caps limit at 200.
const PAGE_SIZE = 50;

// Phase 1 of the advanced-sidebar close, in ms: the inner glass surface
// fades out before the wrapper snaps shut and the cards FLIP back out.
const ADVANCED_CLOSE_PHASE_MS = 120;

interface GameQueryFilters {
  search: string;
  selectedGenres: string[];
  selectedDeck: number[];
  sort: SortKey;
}

function buildGameQuery(filters: GameQueryFilters, offset: number): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.selectedGenres.length) params.set('genre', filters.selectedGenres.join(','));
  if (filters.selectedDeck.length) params.set('deck', filters.selectedDeck.join(','));
  params.set('sort', filters.sort);
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String(offset));
  return params.toString();
}

export function GamesPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();

  // Clamp URL params to known values so hand-edited or stale URLs can't
  // produce an invalid sort key, an off-grid card size, or unknown deck ids.
  const rawSort = searchParams.get('sort');
  const sort: SortKey =
    rawSort !== null && SORT_OPTIONS.some((o) => o.value === rawSort)
      ? (rawSort as SortKey)
      : 'title-asc';
  const search = searchParams.get('search') ?? '';
  const rawGridSize = Number(searchParams.get('gridSize') ?? GRID_SIZE_DEFAULT);
  const gridSize = GRID_SIZES.some((g) => g.value === rawGridSize) ? rawGridSize : GRID_SIZE_DEFAULT;
  const genreParam = searchParams.get('genre') ?? '';
  const deckParam = searchParams.get('deck') ?? '';
  const selectedGenres = useMemo(() => genreParam ? genreParam.split(',').filter(Boolean) : [], [genreParam]);
  const selectedDeck = useMemo(
    () =>
      deckParam
        ? deckParam
            .split(',')
            .filter(Boolean)
            .map(Number)
            .filter((n) => DECK_OPTIONS.some((o) => o.value === n))
        : [],
    [deckParam],
  );

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  // Set before internal URL writes so the searchInput<-URL sync-back effect
  // knows to skip (avoid clobbering active typing with the trimmed URL value).
  const skipSyncRef = useRef(false);
  const [searchExpanded, setSearchExpanded] = useState(search !== '');
  const [items, setItems] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState<Panel>(null);
  // Two-phase close for the advanced sidebar: phase 1 adds .is-closing so
  // the panel's inner glass surface fades out (~120ms) before phase 2
  // (closeTimerRef) commits the closed state — the wrapper then snaps shut
  // invisibly while the grid cards FLIP back out (useGridFlip).
  const [panelClosing, setPanelClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [genresError, setGenresError] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  useTiltGlow(searchRef);
  const gridSizeToggleRef = useRef<HTMLDivElement>(null);
  useGlowFollow(gridSizeToggleRef);
  const gridRef = useRef<HTMLDivElement | null>(null);
  // Window-scrolled row virtualization: only rows near the viewport stay
  // mounted. Owns the grid container height and row transforms.
  // containerRef/rowRef/refreshWidth are stable callbacks from the hook.
  const {
    containerRef: gridContainerRef,
    columns: gridColumns,
    rows: gridRows,
    rowRef: gridRowRef,
    refreshWidth: refreshGridWidth,
  } = useVirtualGrid(items.length, gridSize);
  // FLIP-glides the grid cards when the advanced sidebar toggles. Captured
  // in togglePanel before the state update, played in a layout effect after
  // the new layout commits.
  const flip = useGridFlip(gridRef);
  // Merge the flip/observer gridRef with the virtualizer's container ref.
  const setGridRef = useCallback((node: HTMLDivElement | null) => {
    gridRef.current = node;
    gridContainerRef(node);
  }, [gridContainerRef]);
  // Viewport-entry reveal: toggles .is-visible on rows as they cross the
  // viewport edge — a mount-time animation would play out offscreen in
  // the overscan buffer and never be seen.
  useRevealRows(gridRef, gridRows);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef<HTMLButtonElement>(null);
  useGlowFollow(scrollTopRef);
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Request token: incremented on each reset so stale fetchMore responses
  // (from a superseded filter) are ignored before appending.
  const reqToken = useRef(0);

  // Sync searchInput from URL on external navigation (popstate/initial mount).
  // Skipped after internal debounced/submit writes via skipSyncRef so active
  // typing isn't clobbered by the trimmed value we just wrote to the URL.
  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    setSearchInput(search);
  }, [search]);

  // Fetch distinct genres list once on mount for the genre filter chips.
  useEffect(() => {
    let cancelled = false;
    setGenresError(false);
    api.get<GenresResult>('/api/games/genres')
      .then((res) => { if (!cancelled) setGenres(res.genres); })
      .catch(() => { if (!cancelled) setGenresError(true); });
    return () => { cancelled = true; };
  }, []);

  // Live search: write debounced input to URL (replace => no back-button spam).
  // Existing fetchInitial effect (:123) reacts to the URL change and fetches.
  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed === search) return; // already in URL, no-op
    skipSyncRef.current = true;
    const next = new URLSearchParams(searchParams);
    if (trimmed) next.set('search', trimmed);
    else next.delete('search');
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, search, searchParams, setSearchParams]);

  const fetchInitial = useCallback(async () => {
    const token = ++reqToken.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<GameListResult>(
        `/api/games?${buildGameQuery({ search, selectedGenres, selectedDeck, sort }, 0)}`,
      );
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
  }, [search, sort, selectedGenres, selectedDeck]);

  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const token = reqToken.current;
    setLoadingMore(true);
    try {
      const res = await api.get<GameListResult>(
        `/api/games?${buildGameQuery({ search, selectedGenres, selectedDeck, sort }, items.length)}`,
      );
      if (reqToken.current !== token) return; // superseded by a reset
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(items.length + res.items.length < res.total);
    } catch (err) {
      if (reqToken.current !== token) return;
      setError(err instanceof ApiError ? err.message : 'failed to load more games');
    } finally {
      if (reqToken.current === token) setLoadingMore(false);
    }
  }, [search, sort, selectedGenres, selectedDeck, items.length, loadingMore, hasMore]);

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
  // the top of the viewport. Under virtualization the first row unmounts
  // once it leaves the overscan window (well above the viewport) — that
  // alone means it is gone; while row 0 is mounted, an observer watches
  // it directly (its bottom < 0 means the row is fully above the viewport).
  const firstRowIndex = gridRows[0]?.index ?? -1;
  useEffect(() => {
    if (items.length === 0) {
      setShowScrollTop(false);
      return;
    }
    if (firstRowIndex !== 0) {
      setShowScrollTop(true);
      return;
    }
    const row0 = gridRef.current?.querySelector<HTMLElement>('.game-grid-row[data-index="0"]');
    if (!row0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowScrollTop(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
      },
      { threshold: 0 },
    );
    observer.observe(row0);
    return () => observer.disconnect();
  }, [items.length, firstRowIndex]);

  // Panel height: dynamically set --panel-height so the panel's bottom edge
  // stays 12px from the viewport bottom at all times. The panel sits in
  // .library-body below the header, so its in-flow top is the body's top;
  // as the header scrolls away the sticky panel grows upward until it
  // reaches the sticky top (12px or 74px below nav pill). useLayoutEffect
  // sets the value before paint to avoid a flash of the CSS fallback height
  // when opening at the top of the page.
  useLayoutEffect(() => {
    if (panelOpen !== 'advanced') return;
    const panel = panelRef.current;
    const body = bodyRef.current;
    if (!panel || !body) return;

    const root = document.documentElement;
    const css = getComputedStyle(root);
    const topGap = parseFloat(css.getPropertyValue('--topbar-top-gap')) || 12;
    const flowOffset = parseFloat(css.getPropertyValue('--topbar-flow-offset')) || 74;
    const mq = window.matchMedia('(max-width: 1200px)');

    let raf = 0;
    const update = () => {
      raf = 0;
      const bodyTop = body.getBoundingClientRect().top;
      const minTop = mq.matches ? flowOffset : topGap;
      const top = Math.max(bodyTop, minTop);
      panel.style.setProperty('--panel-height', `calc(100vh - ${top}px - ${topGap}px)`);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    mq.addEventListener('change', update);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      mq.removeEventListener('change', update);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [panelOpen]);

  // Play the captured FLIP after the sidebar layout change commits (before
  // paint, so the inverted transforms land as the animation start state).
  // If the toggle changed the container width, refreshWidth() has scheduled
  // a re-render with the new column count — skip here and let this effect
  // re-run once the re-sliced rows are in place.
  useLayoutEffect(() => {
    if (refreshGridWidth()) return;
    flip.play();
  }, [panelOpen, gridColumns, refreshGridWidth, flip]);

  // Clear any pending close-phase timer and stop any in-flight card glide
  // on unmount to avoid a setState-after-unmount warning or stuck styles.
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      flip.cancel();
    };
  }, [flip]);

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
    const trimmed = searchInput.trim();
    if (trimmed === search) return; // already in URL
    skipSyncRef.current = true;
    const next = new URLSearchParams(searchParams);
    if (trimmed) next.set('search', trimmed);
    else next.delete('search');
    setSearchParams(next, { replace: true });
  }

  function onSortChange(key: SortKey) {
    updateParams({ sort: key });
  }

  function onGridSizeChange(value: number) {
    updateParams({ gridSize: value });
  }

  function toggleGenre(genre: string) {
    const set = new Set(selectedGenres);
    if (set.has(genre)) set.delete(genre);
    else set.add(genre);
    updateParams({ genre: [...set].join(',') });
  }

  function toggleDeck(cat: number) {
    const set = new Set(selectedDeck);
    if (set.has(cat)) set.delete(cat);
    else set.add(cat);
    updateParams({ deck: [...set].join(',') });
  }

  function scheduleAdvancedClose(target: Panel) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setPanelOpen(target);
      setPanelClosing(false);
    }, ADVANCED_CLOSE_PHASE_MS);
  }

  function cancelAdvancedClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function togglePanel(panel: 'advanced' | 'settings') {
    const advancedOpen = panelOpen === 'advanced' && !panelClosing;

    if (panel === 'advanced') {
      if (advancedOpen) {
        // Close, phase 1: fade the inner surface now; phase 2 (timer) snaps
        // the wrapper shut and FLIPs the cards back out.
        flip.capture();
        setPanelClosing(true);
        scheduleAdvancedClose(null);
        return;
      }
      cancelAdvancedClose();
      setPanelClosing(false);
      if (panelOpen === 'advanced') {
        // Re-open mid-close: the layout never changed, so there is nothing
        // to FLIP — just drop the stale capture and let the inner un-fade.
        flip.cancel();
      } else {
        // Open: wrapper snaps wide (invisible — inner starts transparent),
        // cards FLIP to their narrower columns, inner fades/slides in.
        flip.capture();
        setPanelOpen('advanced');
      }
      return;
    }

    // Settings toggle.
    cancelAdvancedClose();
    if (panelOpen === 'advanced') {
      // Advanced is open or mid-close: fade it out first, then swap
      // straight to settings so the sidebar surface never pops.
      flip.capture();
      setPanelClosing(true);
      scheduleAdvancedClose('settings');
      return;
    }
    setPanelClosing(false);
    // The settings panel renders in the header and pushes the body down,
    // so FLIP the cards vertically too.
    flip.capture();
    setPanelOpen((current) => (current === panel ? null : panel));
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="page">
      <div className="library-content">
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
                aria-label="Search games"
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
                        aria-label={`Grid size: ${s.label}`}
                        aria-pressed={gridSize === s.value}
                        type="button"
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

        <div ref={bodyRef} className="library-body">
          <div className="library-main">
            {error && <div className="error">{error}</div>}
            {loading && items.length === 0 && <div className="muted">Loading…</div>}

            {!loading && !error && items.length === 0 && (
              <div className="muted">No games found</div>
            )}

            {/* Virtualized grid: the container is a spacer whose height and
                the row transforms are owned by useVirtualGrid; only rows
                near the viewport are mounted. */}
            <div ref={setGridRef} className="game-grid">
              {gridRows.map((row) => {
                const start = row.index * gridColumns;
                return (
                  <div
                    key={row.key}
                    className="game-grid-row"
                    data-index={row.index}
                    ref={gridRowRef}
                    style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}
                  >
                    {items.slice(start, start + gridColumns).map((g, i) => (
                      <GameCard key={g.id} game={g} index={i} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <aside
            ref={panelRef}
            className={`library-panel--sidebar${panelOpen === 'advanced' ? ' is-visible' : ''}${panelClosing ? ' is-closing' : ''}`}
            aria-hidden={panelOpen !== 'advanced'}
          >
            <div className="library-panel library-panel__inner">
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
                        aria-pressed={sort === o.value}
                        type="button"
                      >
                        <Icon size={14} />
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {genresError && (
                <div className="panel-group">
                  <span className="panel-label">Genre</span>
                  <div className="muted">failed to load genres</div>
                </div>
              )}
              {genres.length > 0 && (
                <div className="panel-group">
                  <span className="panel-label">Genre</span>
                  <div className="panel-chips panel-chips--wrap">
                    {genres.map((g) => (
                      <button
                        key={g}
                        className={`panel-chip${selectedGenres.includes(g) ? ' active' : ''}`}
                        onClick={() => toggleGenre(g)}
                        aria-pressed={selectedGenres.includes(g)}
                        type="button"
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="panel-group">
                <span className="panel-label">Steam Deck</span>
                <div className="panel-chips">
                  {DECK_OPTIONS.map((o) => {
                    const Icon = o.icon;
                    return (
                      <button
                        key={o.value}
                        className={`panel-chip${selectedDeck.includes(o.value) ? ' active' : ''}`}
                        onClick={() => toggleDeck(o.value)}
                        aria-pressed={selectedDeck.includes(o.value)}
                        type="button"
                      >
                        <Icon size={14} />
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </div>
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
        <span className="scroll-top-pill__icon">
          <IconArrowUp size={20} />
        </span>
        <span className="scroll-top-pill__label">Scroll to top</span>
      </button>

      <Outlet />
    </div>
  );
}
