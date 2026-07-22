import { useEffect, useRef, useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { MetadataSearchResponse, SearchResult } from '../api/types';
import { IconButton } from './IconButton';

interface MetadataPickerProps {
  gameId: string;
  initialQuery: string;
  onClose: () => void;
  onAssigned: () => void;
}

export function MetadataPicker({
  gameId,
  initialQuery,
  onClose,
  onAssigned,
}: MetadataPickerProps): JSX.Element {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<MetadataSearchResponse>(
        `/api/games/${gameId}/metadata/search`,
        { query },
      );
      setResults(res.results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'search failed');
    } finally {
      setLoading(false);
    }
  }

  async function assign(remoteId: string) {
    setAssigning(remoteId);
    setError(null);
    try {
      await api.post(`/api/games/${gameId}/metadata/assign`, { remoteId });
      onAssigned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'assign failed');
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Search metadata</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form
          className="modal-search"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Game title…"
          />
          <IconButton
            icon={Search}
            label="Search"
            onClick={runSearch}
            disabled={loading || !query.trim()}
            active
          />
        </form>
        {error && <div className="modal-error">{error}</div>}
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.remoteId} className="search-result">
              <div className="search-result-info">
                <div className="search-result-title">{r.title}</div>
                <div className="search-result-meta">
                  <span>ID: {r.remoteId}</span>
                  {r.releaseYear !== undefined && <span>Year: {r.releaseYear}</span>}
                  {r.score !== undefined && <span>Score: {r.score}</span>}
                </div>
              </div>
              <IconButton
                icon={assigning === r.remoteId ? Check : Check}
                label={assigning === r.remoteId ? 'Assigning…' : 'Assign'}
                onClick={() => assign(r.remoteId)}
                disabled={assigning !== null}
                active={assigning === r.remoteId}
              />
            </li>
          ))}
          {!loading && results.length === 0 && (
            <li className="search-empty">No results yet — search to find metadata</li>
          )}
          {loading && (
            <li className="search-empty">Searching…</li>
          )}
        </ul>
      </div>
    </div>
  );
}