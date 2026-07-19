import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { GameListResult, MatchStatus } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { GameCard } from '../components/GameCard';

interface GamesPageProps {
  onOpenGame: (id: string) => void;
}

const STATUS_OPTIONS: Array<{ value: '' | MatchStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'PENDING' },
  { value: 'FLAGGED', label: 'FLAGGED' },
  { value: 'ACCEPTED', label: 'ACCEPTED' },
  { value: 'MANUAL', label: 'MANUAL' },
  { value: 'REJECTED', label: 'REJECTED' },
];

const LIMIT_OPTIONS = [10, 25, 50, 100];

export function GamesPage({ onOpenGame }: GamesPageProps): JSX.Element {
  const [status, setStatus] = useState<'' | MatchStatus>('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<GameListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    void fetchPage();
  }

  function onStatusChange(value: '' | MatchStatus) {
    setStatus(value);
    setOffset(0);
  }

  function onLimitChange(value: number) {
    setLimit(value);
    setOffset(0);
  }

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const hasPrev = offset > 0;
  const hasNext = offset + items.length < total;

  return (
    <div className="page">
      <PageHeader title="Games" subtitle={`${total} total`} />
      <form className="filters" onSubmit={onSearchSubmit}>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as '' | MatchStatus)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search title or entry name"
        />
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
        >
          {LIMIT_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button type="submit">apply</button>
      </form>

      {error && <div className="error">{error}</div>}
      {loading && <div className="muted">loading…</div>}

      {!loading && !error && items.length === 0 && (
        <div className="muted">no games found</div>
      )}

      <div className="game-grid">
        {items.map((g) => (
          <GameCard key={g.id} game={g} onOpen={onOpenGame} />
        ))}
      </div>

      {total > 0 && (
        <div className="pagination">
          <button
            disabled={!hasPrev}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            prev
          </button>
          <span className="pagination-info">
            {offset + 1}–{offset + items.length} of {total}
          </span>
          <button
            disabled={!hasNext}
            onClick={() => setOffset(offset + limit)}
          >
            next
          </button>
        </div>
      )}
    </div>
  );
}