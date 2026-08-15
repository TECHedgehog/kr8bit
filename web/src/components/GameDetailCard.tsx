import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import IconX from '@tabler/icons-react/dist/esm/icons/IconX.mjs';
import IconRefresh from '@tabler/icons-react/dist/esm/icons/IconRefresh.mjs';
import { api, ApiError } from '../api/client';
import type { Game } from '../api/types';
import { useMarquee } from '../hooks/useMarquee';
import { useToast } from '../context/ToastContext';
import { formatBytes, formatDateTime, joinStringList } from '../format';

export function GameDetailCard(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [heroError, setHeroError] = useState(false);
  const cancelledRef = useRef(false);
  const { viewportRef, textRef } = useMarquee(game?.displayName ?? '');
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const colLeftRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    const el = colLeftRef.current;
    if (!el) return;
    function onScroll() {
      setIsScrolled(el.scrollTop > 0);
    }
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  async function handleRefresh() {
    if (!id) return;
    setRefreshing(true);
    try {
      const updated = await api.post<Game>(`/api/games/${id}/metadata/refresh`);
      if (!cancelledRef.current) {
        if (updated) {
          setGame(updated);
          setHeroError(false);
          toast.success('metadata refreshed');
        } else {
          toast.error('no metadata to refresh');
        }
      }
    } catch (err) {
      if (!cancelledRef.current) {
        toast.error(err instanceof ApiError ? err.message : 'refresh failed');
      }
    } finally {
      if (!cancelledRef.current) setRefreshing(false);
    }
  }

  useEffect(() => {
    cancelledRef.current = false;
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const g = await api.get<Game>(`/api/games/${id}`);
        if (!cancelledRef.current) {
          setGame(g);
        }
      } catch (err) {
        if (!cancelledRef.current) {
          setError(err instanceof ApiError ? err.message : 'failed to load game');
        }
      } finally {
        if (!cancelledRef.current) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelledRef.current = true;
    };
  }, [id]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        navigate('/games');
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  function onClose() {
    const next = new URLSearchParams(searchParams);
    navigate({ pathname: '/games', search: next.toString() });
  }

  if (!id) {
    return <></>;
  }

  return (
    <div className="game-detail-backdrop" onClick={onClose}>
      <div className="game-detail-card" onClick={(e) => e.stopPropagation()}>
        <button
          className="game-detail-close"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <IconX size={20} />
        </button>

        {loading && !game && (
          <div className="game-detail-body">
            <div className="muted">Loading…</div>
          </div>
        )}

        {error && !game && (
          <div className="game-detail-body">
            <div className="error">{error}</div>
          </div>
        )}

        {game && (
          <>
            <div className="game-detail-hero">
              {heroError ? (
                <div className="detail-hero-placeholder" />
              ) : (
                <img
                  src={`/api/games/${game.id}/artwork/header?v=${game.updatedAt}`}
                  alt={game.displayName}
                  onError={() => setHeroError(true)}
                />
              )}
              <div className="game-detail-hero-overlay" />
              <div className="game-detail-hero-blur" />
              <div className="game-detail-title-row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div ref={viewportRef} className="game-detail-title marquee-viewport">
                    <span ref={textRef} className="marquee-text">{game.displayName}</span>
                  </div>
                  <div className="game-detail-subtitle" />
                </div>
              </div>
            </div>

            <div className="game-detail-body">
              <div className="game-detail-columns">
                <div className={`game-detail-col-left ${isScrolled ? 'is-scrolled' : ''}`} ref={colLeftRef}>
                  <section className="detail-section">
                    <div className="detail-section-title">Gallery</div>
                    <div className="game-detail-screenshots-placeholder">
                      <span>Coming soon</span>
                    </div>
                  </section>

                  {game.description && (
                    <section className="detail-section">
                      <div className="detail-section-title">Description</div>
                      <div className="detail-description-text">{game.description}</div>
                    </section>
                  )}
                </div>

                <div className="game-detail-col-right">
                  <section className="detail-section">
                    <div className="detail-meta">
                      <div className="detail-row">
                        <span className="detail-label">Release Date</span>
                        <span className="detail-value">
                          {game.releaseDate ?? (game.releaseYear !== null ? String(game.releaseYear) : '—')}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Developers</span>
                        <span className="detail-value">
                          {joinStringList(game.developers) || '—'}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Publishers</span>
                        <span className="detail-value">
                          {joinStringList(game.publishers) || '—'}
                        </span>
                      </div>
                      {game.genres.length > 0 && (
                        <div className="detail-row">
                          <span className="detail-label">Genres</span>
                          <div className="detail-badges">
                            {game.genres.map((g) => (
                              <span key={g} className="detail-pill">{g}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(game.tags && game.tags.length > 0) && (
                        <div className="detail-row">
                          <span className="detail-label">Tags</span>
                          <div className="detail-badges">
                            {game.tags.map((t) => (
                              <span key={t} className="detail-pill detail-pill--tag">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(!game.tags || game.tags.length === 0) && (
                        <div className="detail-row">
                          <span className="detail-label">Tags</span>
                          <span className="detail-value detail-value--placeholder">—</span>
                        </div>
                      )}
                      {game.ageRating && (
                        <div className="detail-row">
                          <span className="detail-label">Age Rating</span>
                          <span className="detail-pill detail-pill--age">{game.ageRating}</span>
                        </div>
                      )}
                      {!game.ageRating && (
                        <div className="detail-row">
                          <span className="detail-label">Age Rating</span>
                          <span className="detail-value detail-value--placeholder">—</span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span className="detail-label">Metacritic</span>
                        <span className="detail-value">
                          {game.metacriticScore !== null && game.metacriticScore !== undefined
                            ? `${game.metacriticScore}/100`
                            : <span className="detail-value--placeholder">—</span>}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Size</span>
                        <span className="detail-value mono">{formatBytes(game.sizeBytes)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Path</span>
                        <span className="detail-value mono">{game.entryPath}</span>
                      </div>
                      {game.matchedAt && (
                        <div className="detail-row">
                          <span className="detail-label">Matched</span>
                          <span className="detail-value mono">{formatDateTime(game.matchedAt)}</span>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              <div className="game-detail-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <IconRefresh size={16} />
                  {refreshing ? 'Refreshing…' : 'Refresh Metadata'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
