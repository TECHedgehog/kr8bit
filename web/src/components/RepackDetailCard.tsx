import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import IconX from '@tabler/icons-react/dist/esm/icons/IconX.mjs';
import { api, ApiError } from '../api/client';
import type { Game, RepackCatalogGameDetail } from '../api/types';
import { useMarquee } from '../hooks/useMarquee';
import { MediaGallery } from './MediaGallery';
import { RepackMatchControls } from './RepackMatchControls';
import { SteamDeckBadge } from './SteamDeckBadge';

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export function RepackDetailCard(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [detail, setDetail] = useState<RepackCatalogGameDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [heroFailed, setHeroFailed] = useState(false);
  const [leftScrolled, setLeftScrolled] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const { viewportRef, textRef } = useMarquee(detail?.title ?? '');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(''); setHeroFailed(false);
    try { setDetail(await api.get<RepackCatalogGameDetail>(`/api/repack-catalog/${id}`)); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Failed to load repack details'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  useEffect(() => { closeRef.current?.focus(); }, [id]);
  useEffect(() => {
    const element = leftRef.current;
    if (!element) return;
    const onScroll = () => setLeftScrolled(element.scrollTop > 0);
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [detail?.id]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const focusables = Array.from(card.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.hasAttribute('disabled'));
      if (!focusables.length) return;
      const first = focusables[0]; const last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || !card.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !card.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  function onClose() {
    const params = new URLSearchParams(searchParams);
    navigate({ pathname: '/repack-catalog', search: params.toString() });
  }

  if (!id) return <></>;
  const snapshot = detail?.metadataSnapshot;
  const deckStub = {
    steamAppId: snapshot ? (Number(snapshot.remoteId) || 1) : null,
    steamDeckCategory: snapshot?.steamDeckCompat?.category ?? null,
  } as Game;

  return (
    <div className="game-detail-backdrop repack-detail-backdrop" onClick={onClose}>
      <div ref={cardRef} className="game-detail-card repack-detail-card" role="dialog" aria-modal="true" aria-label={detail?.title ?? 'Repack details'} onClick={(event) => event.stopPropagation()}>
        <button ref={closeRef} className="game-detail-close" onClick={onClose} aria-label="Close" type="button">
          <span className="game-detail-close__icon"><IconX size={20} /></span><span className="game-detail-close__label">Close</span>
        </button>
        {loading && !detail && <div className="game-detail-body"><div className="muted">Loading…</div></div>}
        {error && !detail && <div className="game-detail-body"><div className="error">{error}</div></div>}
        {detail && <>
          <div className="game-detail-hero repack-detail-hero">
            {heroFailed ? <div className="detail-hero-placeholder" /> : <img src={`/api/repack-catalog/${detail.id}/artwork/header?v=${encodeURIComponent(detail.updatedAt)}`} alt={snapshot?.title ?? detail.title} onError={() => setHeroFailed(true)} />}
            <div className="game-detail-hero-overlay" />
            <div className="game-detail-hero-blur" />
            <SteamDeckBadge game={deckStub} />
            <div className="repack-detail-match-badge">{detail.matchStatus} MATCH</div>
            <div className="game-detail-title-row"><div style={{ minWidth: 0, flex: 1 }}>
              <div ref={viewportRef} className="game-detail-title marquee-viewport"><span ref={textRef} className="marquee-text">{detail.title}</span></div>
              <div className="game-detail-subtitle">{detail.posts.length} source releases · {snapshot?.title ?? 'Metadata not matched'}</div>
            </div></div>
          </div>
          <div className="game-detail-body">
            <div className="game-detail-columns">
              <div className={`game-detail-col-left${leftScrolled ? ' is-scrolled' : ''}`} ref={leftRef}>
                <section className="detail-section"><MediaGallery screenshots={snapshot?.screenshots} videos={snapshot?.videos} /></section>
                {snapshot?.description && <section className="detail-section"><div className="detail-section-title">Description</div><div className="detail-description-text">{snapshot.description}</div></section>}
                <section className="detail-section repack-posts-section">
                  <div className="detail-section-title">Repack releases <span>{detail.posts.length}</span></div>
                  {detail.posts.map((post) => <article className="repack-post" key={post.id}>
                    <header><span className={`repack-post-kind repack-post-kind--${post.postKind.toLowerCase()}`}>{post.postKind}</span><span>{formatDate(post.publishedAt)}</span><a href={post.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a></header>
                    <h3>{post.title}</h3>
                    {Object.entries(post.details).length > 0 && <dl className="repack-facts">{Object.entries(post.details).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
                    {post.tags.length > 0 && <div className="repack-post__tags">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
                    {post.downloadOptions.length > 0 && <div className="repack-downloads-block"><strong>Download options</strong><ul className="repack-downloads">{post.downloadOptions.map((option) => <li key={option.url}><a href={option.url} target="_blank" rel="noreferrer">{option.label} ↗</a></li>)}</ul></div>}
                  </article>)}
                </section>
              </div>
              <div className="game-detail-col-right">
                <section className="detail-section"><div className="detail-meta">
                  <div className="detail-row"><span className="detail-label">Provider title</span><span className="detail-value">{snapshot?.title ?? '—'}</span></div>
                  <div className="detail-row"><span className="detail-label">Release year</span><span className="detail-value">{snapshot?.releaseYear ?? '—'}</span></div>
                  <div className="detail-row"><span className="detail-label">Latest repack</span><span className="detail-value">{formatDate(detail.latestPostAt)}</span></div>
                  <div className="detail-row"><span className="detail-label">Developers</span><span className="detail-value">{snapshot?.developers.join(', ') || '—'}</span></div>
                  <div className="detail-row"><span className="detail-label">Publishers</span><span className="detail-value">{snapshot?.publishers.join(', ') || '—'}</span></div>
                  <div className="detail-row"><span className="detail-label">Repack source</span><span className="detail-value">{detail.posts[0]?.id ? 'FitGirl' : '—'}</span></div>
                </div></section>
                {snapshot?.genres.length ? <section className="detail-section"><div className="detail-row"><span className="detail-label">Genres</span><div className="detail-badges">{snapshot.genres.map((genre) => <span key={genre} className="detail-pill">{genre}</span>)}</div></div></section> : null}
                {detail.tags.length > 0 && <section className="detail-section"><div className="detail-section-title">FitGirl tags</div><div className="repack-post__tags">{detail.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section>}
                <RepackMatchControls detail={detail} onUpdated={() => {
                  window.dispatchEvent(new Event('repack-catalog-updated'));
                  void load();
                }} />
              </div>
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}
