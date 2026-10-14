import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

export function LibraryLocationSection(): JSX.Element {
  const [libraryRoot, setLibraryRoot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    void api.get<{ libraryRoot: string }>('/api/health').then((health) => {
      if (mounted) setLibraryRoot(health.libraryRoot);
    }).catch((err: unknown) => {
      if (mounted) setError(err instanceof ApiError ? err.message : 'failed to load library location');
    });
    return () => { mounted = false; };
  }, []);

  async function copyPath() {
    if (!libraryRoot) return;
    setCopyMessage('');
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(libraryRoot);
      setCopyMessage('Path copied');
    } catch {
      setCopyMessage('Clipboard unavailable');
    }
  }

  return <div className="library-location-card">
    <div className="library-location-path" aria-live="polite">
      {libraryRoot ? <code title={libraryRoot}>{libraryRoot}</code> : error ? <span className="library-location-message error" role="alert">{error}</span> : <span className="library-location-message">Loading location…</span>}
    </div>
    <div className="library-location-actions">
      <span className="library-location-copy-message" aria-live="polite">{copyMessage}</span>
      <button type="button" onClick={() => void copyPath()} disabled={!libraryRoot}>Copy path</button>
    </div>
  </div>;
}
