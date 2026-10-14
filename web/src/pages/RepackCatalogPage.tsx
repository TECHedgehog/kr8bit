import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type {
  RepackCatalogGame, RepackCatalogGameDetail, RepackCatalogSettings,
  RepackJobStatus, RepackMatchCandidate,
} from '../api/types';
import { PageHeader } from '../components/PageHeader';

type View = 'catalog' | 'review';
interface PageResult<T> { items: T[]; total: number }
type ReviewResult = PageResult<RepackCatalogGame & { matchCandidates: RepackMatchCandidate[] }>;
interface ProviderPreview {
  title: string;
  releaseYear?: number;
  description?: string;
  developers: string[];
  publishers: string[];
  genres: string[];
  coverUrl?: string;
}

const PAGE_SIZE = 24;

export function RepackCatalogPage(): JSX.Element {
  const [view, setView] = useState<View>('catalog');
  const [settings, setSettings] = useState<RepackCatalogSettings | null>(null);
  const [status, setStatus] = useState<RepackJobStatus | null>(null);
  const [catalog, setCatalog] = useState<PageResult<RepackCatalogGame>>({ items: [], total: 0 });
  const [review, setReview] = useState<ReviewResult>({ items: [], total: 0 });
  const [reviewOffset, setReviewOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RepackCatalogGameDetail | null>(null);
  const [preview, setPreview] = useState<ProviderPreview | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<RepackMatchCandidate | null>(null);
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const loadSettings = useCallback(async () => {
    const [nextSettings, nextStatus] = await Promise.all([
      api.get<RepackCatalogSettings>('/api/repack-catalog/settings'),
      api.get<RepackJobStatus>('/api/repack-catalog/status'),
    ]);
    setSettings(nextSettings);
    setStatus(nextStatus);
  }, []);

  const loadCatalog = useCallback(async () => {
    const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
    if (query) params.set('q', query);
    const result = await api.get<PageResult<RepackCatalogGame>>(`/api/repack-catalog?${params}`);
    setCatalog(result);
  }, [offset, query]);

  const loadReview = useCallback(async () => {
    const params = new URLSearchParams({ offset: String(reviewOffset), limit: String(PAGE_SIZE) });
    setReview(await api.get<ReviewResult>(`/api/repack-catalog/review?${params}`));
  }, [reviewOffset]);

  const loadDetail = useCallback(async (id: string) => {
    const result = await api.get<RepackCatalogGameDetail>(`/api/repack-catalog/${id}`);
    setDetail(result);
  }, []);

  const refresh = useCallback(async () => {
    try {
      await Promise.all([loadSettings(), loadCatalog(), loadReview()]);
      setError('');
    } catch (cause) {
      setError((cause as Error).message || 'Unable to load repack catalog');
    }
  }, [loadCatalog, loadReview, loadSettings]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => { void loadSettings().catch(() => {}); }, 2_000);
    return () => window.clearInterval(timer);
  }, [loadSettings]);
  useEffect(() => { if (selectedId) void loadDetail(selectedId).catch((cause) => setError((cause as Error).message)); }, [selectedId, loadDetail]);
  useEffect(() => { setPreview(null); setSelectedCandidate(null); }, [selectedId]);

  const runJob = async (kind: 'recent' | 'archive' | 'audit') => {
    if (kind === 'archive' && !window.confirm('Import all historical FitGirl archive pages? This makes many polite requests and can take a long time.')) return;
    setWorking(true); setError(''); setMessage(kind === 'archive' ? 'Importing archive…' : kind === 'audit' ? 'Auditing older entries…' : 'Checking recent entries…');
    try {
      const result = kind === 'audit'
        ? await api.post<{ blocked?: boolean; cancelled?: boolean; failed?: number; stoppedAfterErrors?: boolean }>('/api/repack-catalog/audit')
        : await api.post<{ blocked?: boolean; cancelled?: boolean; failed?: number; stoppedAfterErrors?: boolean }>('/api/repack-catalog/sync', { fullArchive: kind === 'archive' });
      await refresh();
      setMessage(result.cancelled ? 'Scrape cancelled.' : result.blocked ? 'Source denied requests; crawl stopped.' : result.stoppedAfterErrors ? 'Stopped after repeated fetch failures.' : result.failed ? `Finished with ${result.failed} fetch failures.` : kind === 'archive' ? 'Archive import finished.' : kind === 'audit' ? 'History audit finished.' : 'Recent sync finished.');
    } catch (cause) { setError((cause as Error).message || 'Sync failed'); }
    finally { setWorking(false); }
  };

  const selectGame = async (id: string) => {
    setSelectedId(id); setView('catalog'); setError('');
    try { await loadDetail(id); } catch (cause) { setError((cause as Error).message); }
  };

  const searchCandidates = async (game: RepackCatalogGame & { matchCandidates: RepackMatchCandidate[] }) => {
    setWorking(true); setError('');
    try {
      const result = await api.post<{ candidates: RepackMatchCandidate[] }>(`/api/repack-catalog/${game.id}/candidates/search`, { query: searchText });
      await Promise.all([loadReview(), loadCatalog()]);
      setDetail((current) => current?.id === game.id ? { ...current, matchStatus: result.candidates.length ? 'REVIEW' : 'PENDING', matchCandidates: result.candidates } : current);
      setMessage(`Found ${result.candidates.length} metadata candidates.`);
    } catch (cause) { setError((cause as Error).message || 'Candidate search failed'); }
    finally { setWorking(false); }
  };

  const inspectCandidate = async (gameId: string, candidate: RepackMatchCandidate) => {
    setSelectedCandidate(candidate); setPreview(null); setError('');
    try {
      const result = await api.post<ProviderPreview>(`/api/repack-catalog/${gameId}/candidates/preview`, {
        providerName: candidate.providerName, remoteId: candidate.remoteId,
      });
      setPreview(result);
    } catch (cause) { setError((cause as Error).message || 'Metadata preview failed'); }
  };

  const resolveMatch = async (gameId: string, action: 'accept' | 'reject', candidate?: RepackMatchCandidate) => {
    setWorking(true); setError('');
    try {
      await api.post(`/api/repack-catalog/${gameId}/match`, {
        action, providerName: candidate?.providerName, remoteId: candidate?.remoteId,
      });
      await Promise.all([loadReview(), loadCatalog()]);
      if (selectedId === gameId) await loadDetail(gameId);
      setPreview(null); setSelectedCandidate(null);
      setMessage(action === 'accept' ? 'Metadata match accepted.' : 'Match rejected.');
    } catch (cause) { setError((cause as Error).message || 'Unable to resolve match'); }
    finally { setWorking(false); }
  };

  const selectedReview = review.items.find((game) => game.id === selectedId) ?? review.items[0];
  const pageActions = <div className="repack-actions">
    <button type="button" onClick={() => void runJob('recent')} disabled={!settings?.enabled || working || status?.running}>Sync recent</button>
    <button type="button" className="primary" onClick={() => void runJob('archive')} disabled={!settings?.enabled || working || status?.running}>{settings?.fullImportComplete ? 'Check full archive' : 'Import full archive'}</button>
  </div>;

  return (
    <div className="page repack-page">
      <PageHeader title="Repack catalog" subtitle="Source posts, repack details, download options, and metadata matches." actions={pageActions} />
      {!settings?.enabled && (
        <section className="repack-notice">
          <strong>FitGirl source disabled</strong>
          <p>Enable source to sync recent entries. Full archive import remains a separate manual action.</p>
          <Link to="/settings?category=sources">Open source settings</Link>
        </section>
      )}
      <section className="repack-toolbar" aria-label="Catalog controls">
        <div className="repack-tabs" role="tablist" aria-label="Catalog views">
          <button type="button" role="tab" aria-selected={view === 'catalog'} className={view === 'catalog' ? 'is-active' : ''} onClick={() => setView('catalog')}>Games <span>{catalog.total}</span></button>
          <button type="button" role="tab" aria-selected={view === 'review'} className={view === 'review' ? 'is-active' : ''} onClick={() => { setView('review'); if (!selectedId && review.items[0]) setSelectedId(review.items[0].id); }}>Match review <span>{review.total}</span></button>
        </div>
        {view === 'catalog' && <label className="repack-search"><span className="sr-only">Search repack games</span><input type="search" placeholder="Search games…" value={query} onChange={(event) => { setOffset(0); setQuery(event.target.value); }} /></label>}
        <div className="repack-status" role="status">
          <span className={`repack-status__dot${status?.running ? ' is-running' : ''}`} />
          {status?.running ? `${status.phase}: ${status.processed}/${status.total}` : settings?.enabled ? 'Source ready' : 'Source disabled'}
          {message && <span className="repack-status__message">{message}</span>}
        </div>
      </section>
      {error && <div className="repack-error" role="alert">{error}</div>}
      {view === 'catalog' ? (
        <div className="repack-columns">
          <section className="repack-game-list" aria-label="Repack games">
            {catalog.items.map((game) => <button type="button" key={game.id} className={`repack-game-row${selectedId === game.id ? ' is-selected' : ''}`} onClick={() => void selectGame(game.id)}>
              <span className="repack-game-row__title">{game.title}</span>
              <span className={`repack-match-badge repack-match-badge--${game.matchStatus.toLowerCase()}`}>{game.matchStatus.toLowerCase()}</span>
              <span className="repack-game-row__meta">{game.posts.length} posts</span>
            </button>)}
            {catalog.items.length === 0 && <div className="repack-empty">{settings?.enabled ? 'No games imported yet. Sync recent entries to begin.' : 'Enable FitGirl source to populate catalog.'}</div>}
            {catalog.total > PAGE_SIZE && <div className="repack-pagination"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</button><span>{offset + 1}–{Math.min(offset + PAGE_SIZE, catalog.total)} of {catalog.total}</span><button type="button" disabled={offset + PAGE_SIZE >= catalog.total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</button></div>}
          </section>
          <RepackDetail
            detail={detail}
            searchText={searchText}
            setSearchText={setSearchText}
            selectedCandidate={selectedCandidate}
            preview={preview}
            working={working}
            onSearch={searchCandidates}
            onInspect={inspectCandidate}
            onResolve={resolveMatch}
          />
        </div>
      ) : (
        <ReviewPanel
          games={review.items}
          selected={selectedReview}
          searchText={searchText}
          setSearchText={setSearchText}
          onSelect={(id) => setSelectedId(id)}
          onSearch={searchCandidates}
          onInspect={inspectCandidate}
          selectedCandidate={selectedCandidate}
          preview={preview}
          onResolve={resolveMatch}
          working={working}
          offset={reviewOffset}
          total={review.total}
          onPage={setReviewOffset}
        />
      )}
    </div>
  );
}

function RepackDetail({ detail, searchText, setSearchText, selectedCandidate, preview, working, onSearch, onInspect, onResolve }: {
  detail: RepackCatalogGameDetail | null;
  searchText: string;
  setSearchText: (value: string) => void;
  selectedCandidate: RepackMatchCandidate | null;
  preview: ProviderPreview | null;
  working: boolean;
  onSearch: (game: RepackCatalogGameDetail) => void;
  onInspect: (gameId: string, candidate: RepackMatchCandidate) => void;
  onResolve: (id: string, action: 'accept' | 'reject', candidate?: RepackMatchCandidate) => void;
}): JSX.Element {
  if (!detail) return <aside className="repack-detail repack-detail--empty">Choose a game to inspect source posts.</aside>;
  return <aside className="repack-detail">
    <header className="repack-detail__header"><div><p className="eyebrow">{detail.matchStatus.toLowerCase()} match</p><h2>{detail.title}</h2><p>{detail.posts.length} source posts</p></div></header>
    {detail.metadataSnapshot && <section className="repack-official"><h3>Provider metadata</h3><strong>{detail.metadataSnapshot.title}{detail.metadataSnapshot.releaseYear ? ` (${detail.metadataSnapshot.releaseYear})` : ''}</strong><p>{detail.metadataSnapshot.description}</p><p>{detail.metadataSnapshot.developers.join(', ')}{detail.metadataSnapshot.publishers.length ? ` · ${detail.metadataSnapshot.publishers.join(', ')}` : ''}{detail.metadataSnapshot.genres.length ? ` · ${detail.metadataSnapshot.genres.join(', ')}` : ''}</p></section>}
    <section className="repack-review-detail">
      <h3>Provider match</h3>
      <div className="repack-candidate-search"><input value={searchText} onChange={(event) => setSearchText(event.target.value)} aria-label="Metadata search query" placeholder={detail.title} /><button type="button" onClick={() => onSearch(detail)} disabled={working}>Search providers</button>{detail.matchStatus === 'MATCHED' && <button type="button" className="danger" onClick={() => onResolve(detail.id, 'reject')} disabled={working}>Unmatch</button>}</div>
      <div className="repack-candidates">{detail.matchCandidates.map((candidate) => <button type="button" key={`${candidate.providerName}:${candidate.remoteId}`} className={`repack-candidate${selectedCandidate?.remoteId === candidate.remoteId && selectedCandidate.providerName === candidate.providerName ? ' is-selected' : ''}`} onClick={() => onInspect(detail.id, candidate)}>
        {candidate.coverUrl && <img src={candidate.coverUrl} alt="" loading="lazy" />}
        <span><strong>{candidate.title}</strong><small>{candidate.providerName} · {candidate.releaseYear ?? 'Year unknown'} · score {candidate.score}</small></span>
      </button>)}</div>
      {selectedCandidate && <div className="repack-comparison"><div><p className="eyebrow">FitGirl title</p><h3>{detail.title}</h3></div><div><p className="eyebrow">Provider result</p><h3>{preview?.title ?? selectedCandidate.title}</h3><p>{preview?.releaseYear ?? selectedCandidate.releaseYear ?? 'Year unknown'} · {selectedCandidate.providerName}</p>{preview?.description && <p>{preview.description}</p>}{preview?.developers?.length ? <p>Developers: {preview.developers.join(', ')}</p> : null}{preview?.genres?.length ? <p>Genres: {preview.genres.join(', ')}</p> : null}<button type="button" className="primary" disabled={working || !preview} onClick={() => onResolve(detail.id, 'accept', selectedCandidate)}>Accept this match</button></div></div>}
    </section>
    {detail.tags.length > 0 && <section className="repack-facts"><h3>FitGirl tags</h3><p>{detail.tags.join(', ')}</p></section>}
    {detail.posts.map((post) => <article className="repack-post" key={post.id}>
      <header><span className={`repack-post-kind repack-post-kind--${post.postKind.toLowerCase()}`}>{post.postKind}</span><a href={post.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a></header>
      <h3>{post.title}</h3>
      {Object.entries(post.details).length > 0 && <dl className="repack-facts">{Object.entries(post.details).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      {post.tags.length > 0 && <p className="repack-post__tags">FitGirl tags: {post.tags.join(', ')}</p>}
      {post.downloadOptions.length > 0 && <section><h4>Download options</h4><ul className="repack-downloads">{post.downloadOptions.map((option) => <li key={option.url}><a href={option.url} target="_blank" rel="noreferrer">{option.label}</a></li>)}</ul></section>}
    </article>)}
  </aside>;
}

function ReviewPanel({
  games, selected, searchText, setSearchText, onSelect, onSearch, onInspect,
  selectedCandidate, preview, onResolve, working,
  offset, total, onPage,
}: {
  games: Array<RepackCatalogGame & { matchCandidates: RepackMatchCandidate[] }>;
  selected?: RepackCatalogGame & { matchCandidates: RepackMatchCandidate[] };
  searchText: string;
  setSearchText: (value: string) => void;
  onSelect: (id: string) => void;
  onSearch: (game: RepackCatalogGame & { matchCandidates: RepackMatchCandidate[] }) => void;
  onInspect: (gameId: string, candidate: RepackMatchCandidate) => void;
  selectedCandidate: RepackMatchCandidate | null;
  preview: ProviderPreview | null;
  onResolve: (id: string, action: 'accept' | 'reject', candidate?: RepackMatchCandidate) => void;
  working: boolean;
  offset: number;
  total: number;
  onPage: (offset: number) => void;
}): JSX.Element {
  return <div className="repack-review-layout">
    <section className="repack-review-list" aria-label="Unresolved metadata matches">
      {games.map((game) => <button type="button" key={game.id} className={`repack-game-row${selected?.id === game.id ? ' is-selected' : ''}`} onClick={() => onSelect(game.id)}><span className="repack-game-row__title">{game.title}</span><span className="repack-game-row__meta">{game.matchCandidates.length} candidates</span></button>)}
      {!games.length && <div className="repack-empty">No ambiguous matches need review.</div>}
      {total > PAGE_SIZE && <div className="repack-pagination"><button type="button" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - PAGE_SIZE))}>Previous</button><span>{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span><button type="button" disabled={offset + PAGE_SIZE >= total} onClick={() => onPage(offset + PAGE_SIZE)}>Next</button></div>}
    </section>
    {selected ? <section className="repack-review-detail">
      <header><p className="eyebrow">Metadata review</p><h2>{selected.title}</h2><p>Compare provider candidates before attaching official metadata.</p></header>
      <div className="repack-candidate-search"><input value={searchText} onChange={(event) => setSearchText(event.target.value)} aria-label="Metadata search query" placeholder={selected.title} /><button type="button" onClick={() => onSearch(selected)} disabled={working}>Search providers</button><button type="button" className="danger" onClick={() => onResolve(selected.id, 'reject')} disabled={working}>Reject all</button></div>
      <div className="repack-candidates">{selected.matchCandidates.map((candidate) => <button type="button" key={`${candidate.providerName}:${candidate.remoteId}`} className={`repack-candidate${selectedCandidate?.remoteId === candidate.remoteId && selectedCandidate.providerName === candidate.providerName ? ' is-selected' : ''}`} onClick={() => onInspect(selected.id, candidate)}>
        {candidate.coverUrl && <img src={candidate.coverUrl} alt="" loading="lazy" />}
        <span><strong>{candidate.title}</strong><small>{candidate.providerName} · {candidate.releaseYear ?? 'Year unknown'} · score {candidate.score}</small></span>
      </button>)}</div>
      {selectedCandidate && <div className="repack-comparison"><div><p className="eyebrow">Repack title</p><h3>{selected.title}</h3><p>From FitGirl catalog</p></div><div><p className="eyebrow">Provider result</p><h3>{preview?.title ?? selectedCandidate.title}</h3><p>{preview?.releaseYear ?? selectedCandidate.releaseYear ?? 'Year unknown'} · {selectedCandidate.providerName}</p>{preview?.description && <p>{preview.description}</p>}{preview?.developers?.length ? <p>Developers: {preview.developers.join(', ')}</p> : null}{preview?.genres?.length ? <p>Genres: {preview.genres.join(', ')}</p> : null}<button type="button" className="primary" disabled={working || !preview} onClick={() => onResolve(selected.id, 'accept', selectedCandidate)}>Accept this match</button></div></div>}
    </section> : <section className="repack-review-detail repack-detail--empty">Select ambiguous match to review.</section>}
  </div>;
}
