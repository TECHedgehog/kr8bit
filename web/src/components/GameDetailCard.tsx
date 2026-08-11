import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import IconX from '@tabler/icons-react/dist/esm/icons/IconX.mjs';
import { api, ApiError } from '../api/client';
import type { Game } from '../api/types';
import { useMarquee } from '../hooks/useMarquee';
import { StatusBadge } from './StatusBadge';
import { formatBytes, formatDateTime, joinStringList } from '../format';

export function GameDetailCard(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [heroError, setHeroError] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const cancelledRef = useRef(false);
  const { viewportRef, textRef } = useMarquee(game?.displayName ?? '');

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
                  src={`/api/games/${game.id}/artwork/header`}
                  alt={game.displayName}
                  onError={() => setHeroError(true)}
                />
              )}
              <div className="game-detail-hero-overlay" />
            </div>

            <div className="game-detail-body">
              <div className="game-detail-title-row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div ref={viewportRef} className="game-detail-title marquee-viewport">
                    <span ref={textRef} className="marquee-text">{game.displayName}</span>
                  </div>
                  <div className="game-detail-subtitle">
                    <StatusBadge status={game.matchStatus} />
                    {game.releaseYear && <span>{game.releaseYear}</span>}
                    {game.sizeBytes > 0 && <span>{formatBytes(game.sizeBytes)}</span>}
                  </div>
                </div>
              </div>

              <section className="detail-section">
                <div className="detail-section-title">Information</div>
                <div className="detail-meta">
                  <div className="detail-row">
                    <span className="detail-label">Title</span>
                    <span className="detail-value">{game.title ?? '—'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Release Year</span>
                    <span className="detail-value">
                      {game.releaseYear !== null ? String(game.releaseYear) : '—'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Status</span>
                    <span className="detail-value">
                      <StatusBadge status={game.matchStatus} />
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Match Score</span>
                    <span className="detail-value">
                      {game.matchScore !== null ? `${Math.round(game.matchScore)}%` : '—'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Steam App ID</span>
                    <span className="detail-value">
                      {game.steamAppId !== null ? String(game.steamAppId) : '—'}
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
                  <div className="detail-row">
                    <span className="detail-label">Genres</span>
                    <span className="detail-value">
                      {joinStringList(game.genres) || '—'}
                    </span>
                  </div>
                </div>
              </section>

              {game.description && (
                <section className="detail-section">
                  <div className="detail-section-title">Description</div>
                  <div className="detail-description-text">{game.description}</div>
                </section>
              )}

              <section className="detail-section">
                <div className="detail-section-title">File Details</div>
                <div className="detail-meta">
                  <div className="detail-row">
                    <span className="detail-label">Entry Path</span>
                    <span className="detail-value mono">{game.entryPath}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Entry Name</span>
                    <span className="detail-value mono">{game.entryName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Entry Type</span>
                    <span className="detail-value mono">{game.entryType}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Size</span>
                    <span className="detail-value mono">{formatBytes(game.sizeBytes)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Matched At</span>
                    <span className="detail-value mono">{formatDateTime(game.matchedAt)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Created At</span>
                    <span className="detail-value mono">{formatDateTime(game.createdAt)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Updated At</span>
                    <span className="detail-value mono">{formatDateTime(game.updatedAt)}</span>
                  </div>
                </div>
              </section>

              {!coverError && (
                <section className="detail-section">
                  <div className="detail-section-title">Cover Art</div>
                  <img
                    src={`/api/games/${game.id}/artwork/cover`}
                    alt={`${game.displayName} cover`}
                    onError={() => setCoverError(true)}
                    style={{
                      maxWidth: '300px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                    }}
                  />
                </section>
              )}

              <section className="detail-section">
                <div className="detail-section-title">Screenshots</div>
                <div className="game-detail-screenshots-placeholder">
                  <span>Coming soon</span>
                </div>
              </section>

              <div className="game-detail-actions" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
