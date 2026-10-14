import { useState } from 'react';
import { api } from '../api/client';
import type { RepackCatalogGameDetail, RepackMatchCandidate } from '../api/types';

interface ProviderPreview {
  title: string;
  releaseYear?: number;
  description?: string;
  developers: string[];
  publishers: string[];
  genres: string[];
}

export function RepackMatchControls({ detail, onUpdated }: {
  detail: RepackCatalogGameDetail;
  onUpdated: () => void;
}): JSX.Element {
  const [searchText, setSearchText] = useState('');
  const [candidate, setCandidate] = useState<RepackMatchCandidate | null>(null);
  const [preview, setPreview] = useState<ProviderPreview | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function search() {
    setWorking(true); setError(''); setCandidate(null); setPreview(null);
    try {
      await api.post(`/api/repack-catalog/${detail.id}/candidates/search`, { query: searchText });
      onUpdated();
    } catch (cause) { setError((cause as Error).message || 'Candidate search failed'); }
    finally { setWorking(false); }
  }

  async function inspect(next: RepackMatchCandidate) {
    setCandidate(next); setPreview(null); setError('');
    try {
      setPreview(await api.post<ProviderPreview>(`/api/repack-catalog/${detail.id}/candidates/preview`, {
        providerName: next.providerName, remoteId: next.remoteId,
      }));
    } catch (cause) { setError((cause as Error).message || 'Metadata preview failed'); }
  }

  async function resolve(action: 'accept' | 'reject', selected = candidate) {
    setWorking(true); setError('');
    try {
      await api.post(`/api/repack-catalog/${detail.id}/match`, {
        action, providerName: selected?.providerName, remoteId: selected?.remoteId,
      });
      setCandidate(null); setPreview(null); onUpdated();
    } catch (cause) { setError((cause as Error).message || 'Unable to resolve match'); }
    finally { setWorking(false); }
  }

  return (
    <section className="detail-section repack-match-section">
      <div className="detail-section-title">Metadata match</div>
      <p className="repack-match-section__summary">Status: <strong>{detail.matchStatus}</strong>{detail.matchScore !== null ? ` · score ${detail.matchScore}` : ''}</p>
      <div className="repack-candidate-search">
        <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={detail.title} aria-label="Metadata search query" />
        <button type="button" onClick={() => void search()} disabled={working}>Search providers</button>
        {detail.matchStatus === 'MATCHED' && <button type="button" onClick={() => void resolve('reject', null)} disabled={working}>Unmatch</button>}
        {detail.matchStatus !== 'MATCHED' && <button type="button" className="danger" onClick={() => void resolve('reject', null)} disabled={working}>Reject</button>}
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="repack-candidates">
        {detail.matchCandidates.map((item) => (
          <button
            type="button"
            key={`${item.providerName}:${item.remoteId}`}
            className={`repack-candidate${candidate?.remoteId === item.remoteId && candidate.providerName === item.providerName ? ' is-selected' : ''}`}
            onClick={() => void inspect(item)}
          >
            {item.coverUrl && <img src={item.coverUrl} alt="" loading="lazy" />}
            <span><strong>{item.title}</strong><small>{item.providerName} · {item.releaseYear ?? 'Year unknown'} · score {item.score}</small></span>
          </button>
        ))}
      </div>
      {candidate && <div className="repack-comparison">
        <div><p className="eyebrow">Repack title</p><h3>{detail.title}</h3></div>
        <div>
          <p className="eyebrow">Provider result</p>
          <h3>{preview?.title ?? candidate.title}</h3>
          <p>{preview?.releaseYear ?? candidate.releaseYear ?? 'Year unknown'} · {candidate.providerName}</p>
          {preview?.description && <p>{preview.description}</p>}
          {preview?.developers.length ? <p>Developers: {preview.developers.join(', ')}</p> : null}
          {preview?.genres.length ? <p>Genres: {preview.genres.join(', ')}</p> : null}
          <button type="button" className="primary" disabled={working || !preview} onClick={() => void resolve('accept')}>Accept this match</button>
        </div>
      </div>}
    </section>
  );
}
