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
import IconArrowUp from '@tabler/icons-react/dist/esm/icons/IconArrowUp.mjs';
import { api, ApiError } from '../api/client';
import type { RepackCatalogGame, RepackCatalogSettings, RepackJobStatus } from '../api/types';
import { RepackCard } from '../components/RepackCard';
import { IconButton } from '../components/IconButton';
import { RepackCatalogControls } from '../components/RepackCatalogControls';
import { useNavigationPreferences } from '../context/NavigationPreferencesContext';
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
  const { rememberRepackCatalogPanel, lastRepackCatalogPanel, setLastRepackCatalogPanel } = useNavigationPreferences();

  // Clamp URL params to known values so hand-edited or stale URLs can't
  // produce an invalid sort key, an off-grid card size, or unknown deck ids.
  const rawSort = searchParams.get('sort');
  const sort: SortKey = rawSort !== null && SORT_OPTIONS.some((item) => item.value === rawSort)
    ? rawSort as SortKey
    : 'newest';
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
  // Set before internal URL writes so the searchInput<-URL sync-back effect
  // knows to skip (avoid clobbering active typing with the trimmed URL value).
  const skipSyncRef = useRef(false);
  const skipDebouncedSearchWriteRef = useRef(false);
  const [searchExpanded, setSearchExpanded] = useState(search !== '');
  const [items, setItems] = useState<RepackCatalogGame[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>(() => rememberRepackCatalogPanel ? lastRepackCatalogPanel : null);
  // Two-phase close for the advanced sidebar: phase 1 adds .is-closing so
  // the panel's inner glass surface fades out (~120ms) before phase 2
  // (closeTimerRef) commits the closed state — the wrapper then snaps shut
  // invisibly while the grid cards FLIP back out (useGridFlip).
  const [panelClosing, setPanelClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [genresError, setGenresError] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');
  const [genresExpanded, setGenresExpanded] = useState(false);
  const [settings, setSettings] = useState<RepackCatalogSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [status, setStatus] = useState<RepackJobStatus | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const sortOptionsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const scrollTopRef = useRef<HTMLButtonElement | null>(null);
  const reqToken = useRef(0);
  useTiltGlow(searchRef);
  useGlowFollow(scrollTopRef);
  const gridSizeToggleRef = useRef<HTMLDivElement>(null);
  useGlowFollow(gridSizeToggleRef);
  const {
    containerRef,
    columns,
    rows,
    rowRef,
    refreshWidth: refreshGridWidth,
  } = useVirtualGrid(items.length, gridSize);
  const flip = useGridFlip(gridRef);
  const setGridRef = useCallback((node: HTMLDivElement | null) => {
    gridRef.current = node;
    containerRef(node);
  }, [containerRef]);
  useRevealRows(gridRef, rows);

  useEffect(() => {
    if (rememberRepackCatalogPanel) setLastRepackCatalogPanel(panel);
  }, [panel, rememberRepackCatalogPanel, setLastRepackCatalogPanel]);

  useLayoutEffect(() => {
    panelRef.current?.toggleAttribute('inert', !panel || panelClosing);
  }, [panel, panelClosing]);

  // Sync searchInput from URL on external navigation (popstate/initial mount).
  // Skipped after internal debounced/submit writes via skipSyncRef so active
  // typing isn't clobbered by the trimmed value we just wrote to the URL.
  useEffect(() => {
    if (skipSyncRef.current) { skipSyncRef.current = false; return; }
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const skipPendingSearchWrite = () => { skipDebouncedSearchWriteRef.current = true; };
    window.addEventListener('popstate', skipPendingSearchWrite);
    return () => window.removeEventListener('popstate', skipPendingSearchWrite);
  }, []);

  // Fetch distinct genres list once on mount for the genre filter chips.
  useEffect(() => {
    let cancelled = false;
    setGenresError(false);
    api.get<{ genres: string[] }>('/api/repack-catalog/genres')
      .then((result) => { if (!cancelled) setGenres(result.genres); })
      .catch(() => { if (!cancelled) setGenresError(true); });
    return () => { cancelled = true; };
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const [nextSettings, nextStatus] = await Promise.all([
        api.get<RepackCatalogSettings>('/api/repack-catalog/settings'),
        api.get<RepackJobStatus>('/api/repack-catalog/status'),
      ]);
      setSettings(nextSettings); setStatus(nextStatus);
    } finally {
      setSettingsLoaded(true);
    }
  }, []);
  useEffect(() => { void refreshSettings().catch(() => {}); }, [refreshSettings]);
  useEffect(() => {
    const timer = window.setInterval(() => { void refreshSettings().catch(() => {}); }, 2_000);
    return () => window.clearInterval(timer);
  }, [refreshSettings]);

  // Live search: write debounced input to URL (replace => no back-button spam).
  // The fetchInitial effect reacts to the URL change and fetches.
  useEffect(() => {
    if (skipDebouncedSearchWriteRef.current) { skipDebouncedSearchWriteRef.current = false; return; }
    const trimmed = debouncedSearch.trim();
    if (trimmed === search) return; // already in URL, no-op
    skipSyncRef.current = true;
    const next = new URLSearchParams(searchParams);
    if (trimmed) next.set('search', trimmed);
    else next.delete('search');
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }, [debouncedSearch, search, searchParams, setSearchParams]);

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
    setLoading(true);
    setLoadingMore(false);
    setLoadMoreError(null);
    setError('');
    try {
      const result = await api.get<CatalogResult>(`/api/repack-catalog?${queryString}&offset=0`);
      if (reqToken.current !== token) return; // superseded
      setItems(result.items); setTotal(result.total); setHasMore(result.items.length < result.total);
    } catch (cause) {
      if (reqToken.current === token) setError(cause instanceof ApiError ? cause.message : 'Failed to load repack catalog');
    } finally { if (reqToken.current === token) setLoading(false); }
  }, [queryString]);

  const fetchMore = useCallback(async (retry = false) => {
    if (loadingMore || !hasMore || (loadMoreError && !retry)) return;
    const token = reqToken.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await api.get<CatalogResult>(`/api/repack-catalog?${queryString}&offset=${items.length}`);
      if (reqToken.current !== token) return; // superseded by a reset
      setItems((current) => [...current, ...result.items]);
      setHasMore(items.length + result.items.length < result.total);
    } catch (cause) {
      if (reqToken.current === token) setLoadMoreError(cause instanceof ApiError ? cause.message : 'failed to load more repacks');
    } finally { if (reqToken.current === token) setLoadingMore(false); }
  }, [hasMore, items.length, loadingMore, loadMoreError, queryString]);

  useEffect(() => { void fetchInitial(); }, [fetchInitial]);

  // Scroll the grid back into view when the result set changes (filter/sort),
  // mirroring the library page.
  const resultCriteria = `${search}\u0000${selectedGenres.join('\u0000')}\u0000${selectedDeck.join('\u0000')}\u0000${selectedMatch.join('\u0000')}\u0000${sort}`;
  const previousResultCriteriaRef = useRef(resultCriteria);
  useEffect(() => {
    if (previousResultCriteriaRef.current === resultCriteria) return;
    previousResultCriteriaRef.current = resultCriteria;
    const grid = gridRef.current;
    if (!grid) return;
    const top = grid.getBoundingClientRect().top + window.scrollY;
    const flowOffset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-flow-offset')) || 74;
    window.scrollTo({
      top: Math.max(0, top - flowOffset),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [resultCriteria]);

  // Infinite scroll: observe sentinel, load next chunk when it enters view.
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void fetchMore(); }, { rootMargin: '400px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchMore]);

  // Scroll-to-top visibility: show once the first row scrolls out the top of
  // the viewport (see GamesPage for the virtualization-aware rationale).
  const firstRowIndex = rows[0]?.index ?? -1;
  useEffect(() => {
    if (items.length === 0) { setShowScrollTop(false); return; }
    if (firstRowIndex !== 0) { setShowScrollTop(true); return; }
    const row0 = gridRef.current?.querySelector<HTMLElement>('.game-grid-row[data-index="0"]');
    if (!row0) return;
    const observer = new IntersectionObserver(([entry]) => {
      setShowScrollTop(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
    }, { threshold: 0 });
    observer.observe(row0);
    return () => observer.disconnect();
  }, [items.length, firstRowIndex]);

  // Panel height: dynamically set --panel-height so the panel's bottom edge
  // stays 12px from the viewport bottom at all times (see GamesPage).
  useLayoutEffect(() => {
    if (panel !== 'advanced' && panel !== 'settings') return;
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

  // Play the captured FLIP after the sidebar layout change commits (before
  // paint). If the toggle changed the container width, refreshWidth() has
  // scheduled a re-render with the new column count — skip here and let this
  // effect re-run once the re-sliced rows are in place.
  useLayoutEffect(() => {
    if (refreshGridWidth()) return;
    flip.play();
  }, [panel, columns, refreshGridWidth, flip]);

  // Clear any pending close-phase timer and stop any in-flight card glide
  // on unmount to avoid a setState-after-unmount warning or stuck styles.
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    flip.cancel();
  }, [flip]);

  // First-run empty state: source disabled and nothing synced yet — mirror
  // of the library's never-scanned first-run mode.
  const isFirstRunEmpty = settingsLoaded && settings !== null && !settings.enabled
    && !loading && !error && items.length === 0;
  const isCatalogEmpty = settingsLoaded && !loading && !error && items.length === 0;

  const updateParams = useCallback((updates: Record<string, string | number>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === '' || value === 0) next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { preventScrollReset: true });
  }, [searchParams, setSearchParams]);

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed === search) return; // already in URL
    skipSyncRef.current = true;
    skipDebouncedSearchWriteRef.current = true;
    const next = new URLSearchParams(searchParams);
    if (trimmed) next.set('search', trimmed);
    else next.delete('search');
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  function clearSearch() {
    if (!search && !searchInput) return;
    setSearchInput('');
    if (!search) return;
    skipSyncRef.current = true;
    skipDebouncedSearchWriteRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('search');
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  function toggleGenre(genre: string) {
    const set = new Set(selectedGenres);
    if (set.has(genre)) set.delete(genre);
    else set.add(genre);
    updateParams({ genre: [...set].join(',') });
  }

  function toggleDeck(deck: number) {
    const set = new Set(selectedDeck);
    if (set.has(deck)) set.delete(deck);
    else set.add(deck);
    updateParams({ deck: [...set].join(',') });
  }

  function toggleMatch(match: MatchStatus) {
    const set = new Set(selectedMatch);
    if (set.has(match)) set.delete(match);
    else set.add(match);
    updateParams({ match: [...set].join(',') });
  }

  function clearPanelFilters() {
    updateParams({ genre: '', deck: '', match: '', sort: 'newest' });
  }

  function clearFacets() {
    updateParams({ genre: '', deck: '', match: '' });
  }

  function removeGenre(genre: string) {
    if (selectedGenres.includes(genre)) toggleGenre(genre);
  }

  function removeDeck(deck: number) {
    if (selectedDeck.includes(deck)) toggleDeck(deck);
  }

  function removeMatch(match: MatchStatus) {
    if (selectedMatch.includes(match)) toggleMatch(match);
  }

  function handleSortKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + SORT_OPTIONS.length) % SORT_OPTIONS.length;
    updateParams({ sort: SORT_OPTIONS[nextIndex].value });
    sortOptionsRef.current
      ?.querySelector<HTMLButtonElement>(`[data-sort-index="${nextIndex}"]`)
      ?.focus();
  }

  function closeOrSwitch(target: Panel) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (panel === target && !panelClosing) {
      // Close, phase 1: fade the inner surface now; phase 2 (timer) snaps
      // the wrapper shut and FLIPs the cards back out.
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
      // Re-open mid-close without changing layout.
      closeTimerRef.current = null;
      setPanelClosing(false);
      flip.cancel();
      return;
    }
    if (panel) {
      // Switch panels through same fade phase; sidebar never pops.
      flip.capture();
      setPanelClosing(true);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        setPanel(target);
        setPanelClosing(false);
      }, PANEL_CLOSE_PHASE_MS);
      return;
    }
    setPanelClosing(false);
    // Open: wrapper snaps wide while inner fades/slides in.
    flip.capture();
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

  const activeFilterCount = selectedGenres.length + selectedDeck.length + selectedMatch.length;
  const normalizedGenreSearch = genreSearch.trim().toLowerCase();
  const visibleGenres = genres.filter((genre) => genre.toLowerCase().includes(normalizedGenreSearch));
  const genreLimit = 9;
  const displayedGenres = genresExpanded ? visibleGenres : visibleGenres.slice(0, genreLimit);
  const hiddenGenreCount = Math.max(0, visibleGenres.length - displayedGenres.length);
  const selectedSort = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];
  const hasActiveResultFilters = Boolean(search.trim() || selectedGenres.length || selectedDeck.length || selectedMatch.length);

  return (
    <div className={`page repack-catalog-page${isFirstRunEmpty ? ' library-page--empty' : ''}`}>
      <div className="library-content">
        <div className="library-header">
          <div className="library-toolbar">
            <div className="library-title-block">
              <div className="library-title">Repacks</div>
              <div className="library-subtitle" role="status" aria-live="polite" aria-atomic="true">
                <span key={`${loading}-${total}`} className="library-count-update">
                  {loading ? 'Loading repacks…' : `${total} ${total === 1 ? 'repack' : 'repacks'}`}
                </span>
              </div>
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
                onChange={(event) => setSearchInput(event.target.value)}
                onFocus={() => setSearchExpanded(true)}
                onBlur={() => {
                  if (!searchInput.trim()) {
                    clearSearch();
                    setSearchExpanded(false);
                  }
                }}
                placeholder={searchExpanded ? 'Search repack games…' : 'Search'}
                aria-label="Search repack games"
              />
            </form>

            <IconButton icon={IconAdjustments} label="Advanced search" active={panel === 'advanced'} onClick={() => closeOrSwitch('advanced')} glow />
            <IconButton icon={IconSettings} label="Settings" active={panel === 'settings'} onClick={() => closeOrSwitch('settings')} glow />
          </div>
        </div>

        <div ref={bodyRef} className="library-body">
          <div className="library-main">
            {!settings?.enabled && <div className="repack-source-notice"><strong>FitGirl source disabled.</strong> <Link to="/settings?category=sources">Open source settings</Link></div>}
            {message && <div className="repack-job-message" role="status">{message}</div>}
            {error && <div className="error" role="alert">{error}</div>}
            {loading && items.length === 0 && <div className="muted">Loading repacks…</div>}

            {isCatalogEmpty && (
              <section
                className={`library-empty-state${isFirstRunEmpty ? ' library-empty-state--first-run' : ' library-empty-state--no-results'}`}
                aria-label={isFirstRunEmpty ? 'Empty repack catalog' : 'Repack search results'}
              >
                {isFirstRunEmpty && (
                  <div className="library-empty-placeholders" aria-hidden="true">
                    {Array.from({ length: 60 }, (_, index) => <div className="library-empty-placeholder" key={index} />)}
                  </div>
                )}
                <div className="library-empty-panel">
                  <h2>{isFirstRunEmpty ? 'Start building your repack catalog' : search.trim() ? `No repacks match “${search.trim()}”` : selectedGenres.length || selectedDeck.length || selectedMatch.length ? 'No repacks match these filters' : 'No repacks found'}</h2>
                  {isFirstRunEmpty && <Link className="library-empty-action" to="/settings?category=sources">Open sources</Link>}
                  {!isFirstRunEmpty && hasActiveResultFilters && (
                    <div className="library-empty-actions">
                      {search.trim() && <button className="library-empty-action" onClick={clearSearch} type="button">Clear search</button>}
                      {(selectedGenres.length > 0 || selectedDeck.length > 0 || selectedMatch.length > 0) && <button className="library-empty-action" onClick={clearFacets} type="button">Clear filters</button>}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Virtualized grid: the container is a spacer whose height and
                the row transforms are owned by useVirtualGrid; only rows
                near the viewport are mounted. */}
            <div ref={setGridRef} className="game-grid" aria-label="Repack games">
              {rows.map((row) => {
                const start = row.index * columns;
                const rowItems = items.slice(start, start + columns);
                const emptyCellCount = rowItems.length > 0 && rowItems.length < columns
                  ? columns - rowItems.length
                  : 0;
                return (
                  <div key={row.key} className="game-grid-row" data-index={row.index} ref={rowRef} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                    {rowItems.map((game, index) => <RepackCard key={game.id} game={game} index={index} />)}
                    {Array.from({ length: emptyCellCount }, (_, index) => (
                      <div className="game-grid-placeholder" key={`empty-${start + index}`} aria-hidden="true" />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <aside
            ref={panelRef}
            className={`library-panel--sidebar${panel ? ' is-visible' : ''}${panelClosing ? ' is-closing' : ''}`}
            aria-hidden={!panel || panelClosing}
          >
            <div className="library-panel library-panel__inner">
              {panel === 'settings' ? (
                <>
                  <div className="filter-panel-header"><h2>Settings</h2></div>
                  <div className="filter-section">
                    <span className="panel-label">Grid size</span>
                    <div className="grid-size-toggle glow-follow" ref={gridSizeToggleRef}>
                      <div className="view-toggle-lens">
                        {GRID_SIZES.map((size) => (
                          <button
                            key={size.value}
                            className={`size-button${gridSize === size.value ? ' active' : ''}`}
                            onClick={() => updateParams({ gridSize: size.value })}
                            title={size.label}
                            aria-label={`Grid size: ${size.label}`}
                            aria-pressed={gridSize === size.value}
                            type="button"
                          >
                            <IconSquareFilled size={size.iconSize} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="filter-section"><RepackCatalogControls settings={settings} status={status} working={working} onRun={(kind) => void runJob(kind)} /></div>
                  <div className="filter-section"><Link to="/settings?category=sources">Source configuration</Link></div>
                </>
              ) : (
                <>
                  <div className="filter-panel-header">
                    <h2>Advanced Search</h2>
                    <button className="filter-panel-action" onClick={clearPanelFilters} type="button" aria-label="Reset filters and sort">
                      Reset filters + sort
                    </button>
                  </div>

                  {activeFilterCount > 0 && (
                    <div className="filter-summary">
                      <span className="filter-summary__count">{activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active</span>
                      <div className="filter-summary__pills">
                        {selectedGenres.map((genre) => (
                          <button key={genre} className="filter-summary__pill" onClick={() => removeGenre(genre)} type="button" aria-label={`Remove ${genre} filter`}>
                            {genre}<span aria-hidden="true">×</span>
                          </button>
                        ))}
                        {selectedDeck.map((deck) => {
                          const option = DECK_OPTIONS.find((item) => item.value === deck);
                          if (!option) return null;
                          return (
                            <button key={deck} className="filter-summary__pill" onClick={() => removeDeck(deck)} type="button" aria-label={`Remove ${option.label} filter`}>
                              {option.label}<span aria-hidden="true">×</span>
                            </button>
                          );
                        })}
                        {selectedMatch.map((match) => (
                          <button key={match} className="filter-summary__pill" onClick={() => removeMatch(match)} type="button" aria-label={`Remove ${match} filter`}>
                            {match}<span aria-hidden="true">×</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="filter-section">
                    <span className="panel-label">Sort by</span>
                    <div className="sort-menu__options" ref={sortOptionsRef} role="group" aria-label="Sort repack games">
                      {SORT_OPTIONS.map((option, index) => (
                        <button
                          key={option.value}
                          className={`sort-menu__option${sort === option.value ? ' active' : ''}`}
                          type="button"
                          data-sort-index={index}
                          aria-pressed={sort === option.value}
                          onKeyDown={(event) => handleSortKeyDown(event, index)}
                          onClick={() => updateParams({ sort: option.value })}
                        >
                          <option.icon size={14} aria-hidden="true" />
                          {option.label}
                        </button>
                      ))}
                      <span className="sort-menu__announcement" role="status" aria-live="polite">Sorted by {selectedSort.label}</span>
                    </div>
                  </div>

                  {genresError && (
                    <div className="filter-section">
                      <span className="panel-label">Genre</span>
                      <div className="muted">failed to load genres</div>
                    </div>
                  )}
                  {genres.length > 0 && (
                    <div className="filter-section">
                      <span className="panel-label">Genre</span>
                      <div className="genre-filter">
                        <div
                          className="genre-search"
                          onClick={(event) => {
                            if (event.target instanceof HTMLInputElement) return;
                            event.currentTarget.querySelector('input')?.focus();
                          }}
                        >
                          <IconSearch size={14} aria-hidden="true" />
                          <input value={genreSearch} onChange={(event) => setGenreSearch(event.target.value)} placeholder="Search genres…" aria-label="Search genres" />
                        </div>
                        <div className="panel-chips panel-chips--wrap">
                          {displayedGenres.map((genre) => (
                            <button
                              key={genre}
                              className={`panel-chip${selectedGenres.includes(genre) ? ' active' : ''}`}
                              onClick={() => toggleGenre(genre)}
                              aria-pressed={selectedGenres.includes(genre)}
                              type="button"
                            >
                              {genre}
                            </button>
                          ))}
                        </div>
                        {hiddenGenreCount > 0 && (
                          <button className="genre-more" onClick={() => setGenresExpanded(true)} type="button">
                            + {hiddenGenreCount} more
                          </button>
                        )}
                        {genresExpanded && visibleGenres.length > genreLimit && (
                          <button className="genre-more" onClick={() => setGenresExpanded(false)} type="button">
                            Show less
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="filter-section">
                    <span className="panel-label">Steam Deck</span>
                    <div className="deck-filter-grid">
                      {DECK_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.value}
                            className={`panel-chip${selectedDeck.includes(option.value) ? ' active' : ''}`}
                            onClick={() => toggleDeck(option.value)}
                            aria-pressed={selectedDeck.includes(option.value)}
                            type="button"
                          >
                            <Icon size={14} />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="filter-section">
                    <span className="panel-label">Match status</span>
                    <div className="panel-chips panel-chips--wrap">
                      {MATCH_OPTIONS.map((match) => (
                        <button
                          key={match}
                          className={`panel-chip${selectedMatch.includes(match) ? ' active' : ''}`}
                          onClick={() => toggleMatch(match)}
                          aria-pressed={selectedMatch.includes(match)}
                          type="button"
                        >
                          {match}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="filter-panel-footer">
                    <strong>{total} {total === 1 ? 'repack' : 'repacks'}</strong>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {loadingMore && <div className="muted" role="status">Loading more…</div>}

      <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />
      {loadMoreError && (
        <div className="load-more-error" role="alert">
          <span>{loadMoreError}</span>
          <button type="button" onClick={() => void fetchMore(true)}>Retry</button>
        </div>
      )}

      <button
        ref={scrollTopRef}
        className={`topbar-pill scroll-top-pill glow-follow${showScrollTop ? ' is-visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Scroll to top"
        type="button"
      >
        <span className="scroll-top-pill__icon"><IconArrowUp size={20} /></span>
        <span className="scroll-top-pill__label">Scroll to top</span>
      </button>

      <Outlet context={{ refreshCatalog: fetchInitial }} />
    </div>
  );
}
