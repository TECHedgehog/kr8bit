import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useSearchParams } from 'react-router-dom';
import IconSearch from '@tabler/icons-react/dist/esm/icons/IconSearch.mjs';
import IconAdjustments from '@tabler/icons-react/dist/esm/icons/IconAdjustments.mjs';
import IconSettings from '@tabler/icons-react/dist/esm/icons/IconSettings.mjs';
import IconSortAZ from '@tabler/icons-react/dist/esm/icons/IconSortAZ.mjs';
import IconSortZA from '@tabler/icons-react/dist/esm/icons/IconSortZA.mjs';
import IconCalendarClock from '@tabler/icons-react/dist/esm/icons/IconCalendarClock.mjs';
import IconCalendarMonth from '@tabler/icons-react/dist/esm/icons/IconCalendarMonth.mjs';
import IconCircleCheckFilled from '@tabler/icons-react/dist/esm/icons/IconCircleCheckFilled.mjs';
import IconCircleXFilled from '@tabler/icons-react/dist/esm/icons/IconCircleXFilled.mjs';
import IconCircleCaretRightFilled from '@tabler/icons-react/dist/esm/icons/IconCircleCaretRightFilled.mjs';
import IconHelpCircleFilled from '@tabler/icons-react/dist/esm/icons/IconHelpCircleFilled.mjs';
import IconSquareFilled from '@tabler/icons-react/dist/esm/icons/IconSquareFilled.mjs';
import IconChevronDown from '@tabler/icons-react/dist/esm/icons/IconChevronDown.mjs';
import IconArrowUp from '@tabler/icons-react/dist/esm/icons/IconArrowUp.mjs';
import { api, ApiError } from '../api/client';
import type { RepackCatalogGame, RepackCatalogSettings, RepackJobStatus } from '../api/types';
import { RepackCard } from '../components/RepackCard';
import { IconButton } from '../components/IconButton';
import { RepackCatalogControls } from '../components/RepackCatalogControls';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useGridFlip } from '../hooks/useGridFlip';
import { useRevealRows } from '../hooks/useRevealRows';
import { useTiltGlow } from '../hooks/useTiltGlow';
import { useVirtualGrid } from '../hooks/useVirtualGrid';
import { useGlowFollow } from '../hooks/useGlowFollow';

type Panel = 'advanced' | 'settings' | null;
type SortKey = 'title-asc' | 'title-desc' | 'newest' | 'oldest';
type MatchStatus = RepackCatalogGame['matchStatus'];

const PAGE_SIZE = 50;
const PANEL_CLOSE_PHASE_MS = 120;
const GRID_SIZES = [
  { label: 'Small', value: 130, iconSize: 10 },
  { label: 'Medium', value: 160, iconSize: 12 },
  { label: 'Large', value: 190, iconSize: 15 },
];
const SORT_OPTIONS: Array<{ value: SortKey; label: string; icon: typeof IconSortAZ }> = [
  { value: 'title-asc', label: 'Title A-Z', icon: IconSortAZ },
  { value: 'title-desc', label: 'Title Z-A', icon: IconSortZA },
  { value: 'newest', label: 'Newest release', icon: IconCalendarClock },
  { value: 'oldest', label: 'Oldest release', icon: IconCalendarMonth },
];
const DECK_OPTIONS = [
  { value: 3, label: 'Verified', icon: IconCircleCheckFilled },
  { value: 2, label: 'Playable', icon: IconCircleCaretRightFilled },
  { value: 1, label: 'Unsupported', icon: IconCircleXFilled },
  { value: 0, label: 'Unknown', icon: IconHelpCircleFilled },
];
const MATCH_OPTIONS: MatchStatus[] = ['MATCHED', 'REVIEW', 'PENDING', 'REJECTED'];

interface CatalogResult { items: RepackCatalogGame[]; total: number }

function parseList<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  return value ? value.split(',').filter((item): item is T => allowed.includes(item as T)) : [];
}

export function RepackCatalogPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSort = searchParams.get('sort');
  const sort: SortKey = SORT_OPTIONS.some((item) => item.value === rawSort) ? rawSort as SortKey : 'title-asc';
  const search = searchParams.get('search') ?? '';
  const genresParam = searchParams.get('genre') ?? '';
  const deckParam = searchParams.get('deck') ?? '';
  const matchParam = searchParams.get('match') ?? '';
  const selectedGenres = useMemo(() => genresParam ? genresParam.split(',').filter(Boolean) : [], [genresParam]);
  const selectedDeck = useMemo(() => deckParam.split(',').filter(Boolean).map(Number).filter((value) => DECK_OPTIONS.some((item) => item.value === value)), [deckParam]);
  const selectedMatch = useMemo(() => parseList(matchParam, MATCH_OPTIONS), [matchParam]);
  const rawGridSize = Number(searchParams.get('gridSize') ?? 160);
  const gridSize = GRID_SIZES.some((size) => size.value === rawGridSize) ? rawGridSize : 160;

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [items, setItems] = useState<RepackCatalogGame[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [panelClosing, setPanelClosing] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [genresError, setGenresError] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');
  const [genresExpanded, setGenresExpanded] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [settings, setSettings] = useState<RepackCatalogSettings | null>(null);
  const [status, setStatus] = useState<RepackJobStatus | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTopRef = useRef<HTMLButtonElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const reqToken = useRef(0);
  const skipSyncRef = useRef(false);
  useTiltGlow(searchRef);
  useGlowFollow(scrollTopRef);
  const gridSizeToggleRef = useRef<HTMLDivElement>(null);
  useGlowFollow(gridSizeToggleRef);
  const { containerRef, columns, rows, rowRef } = useVirtualGrid(items.length, gridSize);
  const flip = useGridFlip(gridRef);
  const setGridRef = useCallback((node: HTMLDivElement | null) => {
    gridRef.current = node;
    containerRef(node);
  }, [containerRef]);
  useRevealRows(gridRef, rows);

  const updateParams = useCallback((updates: Record<string, string | number>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === '' || value === 0) next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { preventScrollReset: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (skipSyncRef.current) { skipSyncRef.current = false; return; }
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed === search) return;
    skipSyncRef.current = true;
    updateParams({ search: trimmed });
  }, [debouncedSearch, search, updateParams]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), sort });
    if (search.trim()) params.set('q', search.trim());
    if (selectedGenres.length) params.set('genre', selectedGenres.join(','));
    if (selectedDeck.length) params.set('deck', selectedDeck.join(','));
    if (selectedMatch.length) params.set('match', selectedMatch.join(','));
    return params.toString();
  }, [search, sort, selectedGenres, selectedDeck, selectedMatch]);

  const fetchInitial = useCallback(async () => {
    const token = ++reqToken.current;
    setLoading(true); setError('');
    try {
      const result = await api.get<CatalogResult>(`/api/repack-catalog?${queryString}&offset=0`);
      if (reqToken.current !== token) return;
      setItems(result.items); setTotal(result.total); setHasMore(result.items.length < result.total);
    } catch (cause) {
      if (reqToken.current === token) setError(cause instanceof ApiError ? cause.message : 'Failed to load repack catalog');
    } finally { if (reqToken.current === token) setLoading(false); }
  }, [queryString]);

  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const token = reqToken.current;
    setLoadingMore(true);
    try {
      const result = await api.get<CatalogResult>(`/api/repack-catalog?${queryString}&offset=${items.length}`);
      if (reqToken.current !== token) return;
      setItems((current) => [...current, ...result.items]);
      setHasMore(items.length + result.items.length < result.total);
    } catch (cause) { if (reqToken.current === token) setError(cause instanceof ApiError ? cause.message : 'Failed to load more repacks'); }
    finally { if (reqToken.current === token) setLoadingMore(false); }
  }, [hasMore, items.length, loadingMore, queryString]);

  useEffect(() => { void fetchInitial(); }, [fetchInitial]);
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void fetchMore(); }, { rootMargin: '400px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchMore]);

  useEffect(() => {
    let cancelled = false;
    api.get<{ genres: string[] }>('/api/repack-catalog/genres')
      .then((result) => { if (!cancelled) setGenres(result.genres); })
      .catch(() => { if (!cancelled) setGenresError(true); });
    return () => { cancelled = true; };
  }, []);

  const refreshSettings = useCallback(async () => {
    const [nextSettings, nextStatus] = await Promise.all([
      api.get<RepackCatalogSettings>('/api/repack-catalog/settings'),
      api.get<RepackJobStatus>('/api/repack-catalog/status'),
    ]);
    setSettings(nextSettings); setStatus(nextStatus);
  }, []);
  useEffect(() => { void refreshSettings().catch(() => {}); }, [refreshSettings]);
  useEffect(() => {
    const timer = window.setInterval(() => { void refreshSettings().catch(() => {}); }, 2_000);
    return () => window.clearInterval(timer);
  }, [refreshSettings]);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const close = (event: MouseEvent) => { if (!sortMenuRef.current?.contains(event.target as Node)) setSortMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSortMenuOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [sortMenuOpen]);

  useLayoutEffect(() => {
    if (!panel) return;
    const sidebar = panelRef.current;
    const body = bodyRef.current;
    if (!sidebar || !body) return;
    const rootStyle = getComputedStyle(document.documentElement);
    const topGap = parseFloat(rootStyle.getPropertyValue('--topbar-top-gap')) || 12;
    const flowOffset = parseFloat(rootStyle.getPropertyValue('--topbar-flow-offset')) || 74;
    const media = window.matchMedia('(max-width: 1200px)');
    let frame = 0;
    let targetHeight = 0;
    const update = (immediate = false) => {
      const minTop = media.matches ? flowOffset : topGap;
      const top = Math.max(body.getBoundingClientRect().top, minTop);
      targetHeight = Math.max(0, window.innerHeight - top - topGap);
      if (immediate) sidebar.style.setProperty('--panel-height', `${targetHeight}px`);
      else if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        sidebar.style.setProperty('--panel-height', `${targetHeight}px`);
      });
    };
    const onLayout = () => update();
    update(true);
    window.addEventListener('scroll', onLayout, { passive: true });
    window.addEventListener('resize', onLayout);
    media.addEventListener('change', onLayout);
    return () => {
      window.removeEventListener('scroll', onLayout);
      window.removeEventListener('resize', onLayout);
      media.removeEventListener('change', onLayout);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [panel]);

  useEffect(() => { flip.play(); }, [panel, columns, flip]);
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    flip.cancel();
  }, [flip]);

  useEffect(() => {
    if (!items.length || (rows[0]?.index ?? -1) !== 0) {
      setShowScrollTop(items.length > 0 && (rows[0]?.index ?? -1) !== 0);
      return;
    }
    const firstRow = gridRef.current?.querySelector<HTMLElement>('.game-grid-row[data-index="0"]');
    if (!firstRow) return;
    const observer = new IntersectionObserver(([entry]) => {
      setShowScrollTop(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
    });
    observer.observe(firstRow);
    return () => observer.disconnect();
  }, [items.length, rows]);

  const visibleGenres = genres.filter((genre) => genre.toLowerCase().includes(genreSearch.trim().toLowerCase()));
  const displayedGenres = genresExpanded ? visibleGenres : visibleGenres.slice(0, 9);
  const selectedSort = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];
  const SortIcon = selectedSort.icon;
  const activeFilterCount = selectedGenres.length + selectedDeck.length + selectedMatch.length;

  function toggleSet(key: 'genre' | 'deck' | 'match', value: string) {
    const current = new Set((searchParams.get(key) ?? '').split(',').filter(Boolean));
    if (current.has(value)) current.delete(value); else current.add(value);
    updateParams({ [key]: [...current].join(',') });
  }

  function closeOrSwitch(target: Panel) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (panel === target && !panelClosing) {
      flip.capture();
      setPanelClosing(true);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        setPanel(null);
        setPanelClosing(false);
      }, PANEL_CLOSE_PHASE_MS);
      return;
    }
    if (panel === target && panelClosing) {
      closeTimerRef.current = null;
      setPanelClosing(false);
      flip.cancel();
      return;
    }
    if (panel) {
      flip.capture();
      setPanelClosing(true);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        setPanel(target);
        setPanelClosing(false);
      }, PANEL_CLOSE_PHASE_MS);
      return;
    }
    flip.capture();
    setPanelClosing(false);
    setPanel(target);
  }

  function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

  async function runJob(kind: 'recent' | 'archive' | 'audit') {
    if (kind === 'archive' && !window.confirm('Import all historical FitGirl archive pages? This can take a long time.')) return;
    setWorking(true); setError(''); setMessage(kind === 'archive' ? 'Importing archive…' : kind === 'audit' ? 'Auditing history…' : 'Syncing recent entries…');
    try {
      const result = kind === 'audit'
        ? await api.post<{ cancelled?: boolean; blocked?: boolean; failed?: number }>('/api/repack-catalog/audit')
        : await api.post<{ cancelled?: boolean; blocked?: boolean; failed?: number; stoppedAfterErrors?: boolean }>('/api/repack-catalog/sync', { fullArchive: kind === 'archive' });
      await Promise.all([refreshSettings(), fetchInitial()]);
      setMessage(result.cancelled ? 'Scrape cancelled.' : result.blocked ? 'Source denied requests; crawl stopped.' : result.failed ? `Finished with ${result.failed} failures.` : kind === 'archive' ? 'Archive import finished.' : kind === 'audit' ? 'History audit finished.' : 'Recent sync finished.');
    } catch (cause) { setError((cause as Error).message || 'Catalog job failed'); }
    finally { setWorking(false); }
  }

  return (
    <div className="page repack-catalog-page">
      <div className="library-content">
        <header className="library-header">
          <div className="library-toolbar">
            <div className="library-title-block">
              <div className="library-title">Repacks</div>
              <div className="library-subtitle">{total} {total === 1 ? 'game' : 'games'} · source releases + metadata</div>
            </div>
            <div className="toolbar-spacer" />
            <form ref={searchRef} className="library-search tilt-glow is-expanded" onSubmit={(event) => event.preventDefault()} onClick={() => searchRef.current?.querySelector('input')?.focus()}>
              <IconSearch size={16} />
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search repack games…" aria-label="Search repack games" />
            </form>
            <IconButton icon={IconAdjustments} label="Advanced search" active={panel === 'advanced'} onClick={() => closeOrSwitch('advanced')} glow />
            <IconButton icon={IconSettings} label="Settings" active={panel === 'settings'} onClick={() => closeOrSwitch('settings')} glow />
          </div>
        </header>

        <div ref={bodyRef} className="library-body">
          <main className="library-main">
            {!settings?.enabled && <div className="repack-source-notice"><strong>FitGirl source disabled.</strong> <Link to="/settings?category=sources">Open source settings</Link></div>}
            {message && <div className="repack-job-message" role="status">{message}</div>}
            {error && <div className="error" role="alert">{error}</div>}
            {loading && items.length === 0 && <div className="muted">Loading repacks…</div>}
            {!loading && !error && items.length === 0 && <section className="repack-empty-state"><h2>No repack games found</h2><p>Try clearing filters or sync the catalog from settings.</p></section>}
            <div ref={setGridRef} className="game-grid" aria-label="Repack games">
              {rows.map((row) => {
                const start = row.index * columns;
                const rowItems = items.slice(start, start + columns);
                return <div key={row.key} className="game-grid-row" data-index={row.index} ref={rowRef} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                  {rowItems.map((game, index) => <RepackCard key={game.id} game={game} index={index} />)}
                </div>;
              })}
            </div>
          </main>

          <aside ref={panelRef} className={`library-panel--sidebar${panel ? ' is-visible' : ''}${panelClosing ? ' is-closing' : ''}`} aria-hidden={!panel}>
            <div className="library-panel library-panel__inner">
              {panel === 'settings' ? <>
                <div className="filter-panel-header"><h2>Settings</h2></div>
                <div className="filter-section">
                  <span className="panel-label">Grid size</span>
                  <div className="grid-size-toggle glow-follow" ref={gridSizeToggleRef}>
                    <div className="view-toggle-lens">{GRID_SIZES.map((size) => <button key={size.value} className={`size-button${gridSize === size.value ? ' active' : ''}`} onClick={() => updateParams({ gridSize: size.value })} title={size.label} aria-label={`Grid size: ${size.label}`} aria-pressed={gridSize === size.value} type="button"><IconSquareFilled size={size.iconSize} /></button>)}</div>
                  </div>
                </div>
                <div className="filter-section"><RepackCatalogControls settings={settings} status={status} working={working} onRun={(kind) => void runJob(kind)} /></div>
                <div className="filter-section"><Link to="/settings?category=sources">Source configuration</Link></div>
              </> : <>
                <div className="filter-panel-header"><h2>Advanced Search</h2><button className="filter-panel-action" onClick={() => updateParams({ genre: '', deck: '', match: '', sort: 'title-asc' })} type="button">Reset</button></div>
                {activeFilterCount > 0 && <div className="filter-summary"><span className="filter-summary__count">{activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active</span><div className="filter-summary__pills">
                  {selectedGenres.map((genre) => <button key={genre} className="filter-summary__pill" onClick={() => toggleSet('genre', genre)} type="button">{genre}<span aria-hidden="true">×</span></button>)}
                  {selectedDeck.map((deck) => <button key={deck} className="filter-summary__pill" onClick={() => toggleSet('deck', String(deck))} type="button">{DECK_OPTIONS.find((option) => option.value === deck)?.label}<span aria-hidden="true">×</span></button>)}
                  {selectedMatch.map((match) => <button key={match} className="filter-summary__pill" onClick={() => toggleSet('match', match)} type="button">{match}<span aria-hidden="true">×</span></button>)}
                </div></div>}
                <div className="filter-section"><span className="panel-label">Sort</span><div className="sort-menu" ref={sortMenuRef}>
                  <button className="sort-menu__trigger" type="button" aria-haspopup="listbox" aria-expanded={sortMenuOpen} onClick={() => setSortMenuOpen((open) => !open)}><SortIcon size={14} /><span>{selectedSort.label}</span><IconChevronDown size={16} /></button>
                  {sortMenuOpen && <div className="sort-menu__options" role="listbox" aria-label="Sort repack games">{SORT_OPTIONS.map((option) => <button key={option.value} className={`sort-menu__option${sort === option.value ? ' active' : ''}`} type="button" role="option" aria-selected={sort === option.value} onClick={() => { updateParams({ sort: option.value }); setSortMenuOpen(false); }}><option.icon size={14} />{option.label}</button>)}</div>}
                </div></div>
                {genresError && <div className="filter-section"><span className="panel-label">Genre</span><span className="muted">Unable to load genres.</span></div>}
                {genres.length > 0 && <div className="filter-section"><span className="panel-label">Genre</span><div className="genre-filter"><div className="genre-search"><IconSearch size={14} /><input value={genreSearch} onChange={(event) => setGenreSearch(event.target.value)} placeholder="Search genres…" aria-label="Search genres" /></div><div className="panel-chips panel-chips--wrap">{displayedGenres.map((genre) => <button key={genre} className={`panel-chip${selectedGenres.includes(genre) ? ' active' : ''}`} onClick={() => toggleSet('genre', genre)} aria-pressed={selectedGenres.includes(genre)} type="button">{genre}</button>)}</div>{visibleGenres.length > 9 && <button className="genre-more" onClick={() => setGenresExpanded((expanded) => !expanded)} type="button">{genresExpanded ? 'Show less' : `+ ${visibleGenres.length - 9} more`}</button>}</div></div>}
                <div className="filter-section"><span className="panel-label">Steam Deck</span><div className="deck-filter-grid">{DECK_OPTIONS.map((option) => { const Icon = option.icon; return <button key={option.value} className={`panel-chip${selectedDeck.includes(option.value) ? ' active' : ''}`} onClick={() => toggleSet('deck', String(option.value))} aria-pressed={selectedDeck.includes(option.value)} type="button"><Icon size={14} />{option.label}</button>; })}</div></div>
                <div className="filter-section"><span className="panel-label">Match status</span><div className="panel-chips panel-chips--wrap">{MATCH_OPTIONS.map((match) => <button key={match} className={`panel-chip${selectedMatch.includes(match) ? ' active' : ''}`} onClick={() => toggleSet('match', match)} aria-pressed={selectedMatch.includes(match)} type="button">{match}</button>)}</div></div>
                <div className="filter-panel-footer"><strong>{total} {total === 1 ? 'game' : 'games'}</strong></div>
              </>}
            </div>
          </aside>
        </div>
      </div>
      {loadingMore && <div className="muted">Loading more…</div>}
      <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />
      <button ref={scrollTopRef} className={`topbar-pill scroll-top-pill glow-follow${showScrollTop ? ' is-visible' : ''}`} onClick={scrollToTop} aria-label="Scroll to top" type="button">
        <span className="scroll-top-pill__icon"><IconArrowUp size={20} /></span>
        <span className="scroll-top-pill__label">Scroll to top</span>
      </button>
      <Outlet context={{ refreshCatalog: fetchInitial }} />
    </div>
  );
}
