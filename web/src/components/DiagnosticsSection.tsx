import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

interface DiagnosticsStatus {
  runId: string | null;
  running: boolean;
  processed: number;
  total: number | null;
  failed: number;
  reportReady: boolean;
  completedAt: string | null;
  error: string | null;
}

export function DiagnosticsSection(): JSX.Element {
  const [status, setStatus] = useState<DiagnosticsStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await api.get<DiagnosticsStatus>('/api/diagnostics/status');
      setStatus(next);
      setError(next.error);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to load diagnostics status');
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!status?.running) return;
    const interval = window.setInterval(() => void refreshStatus(), 1000);
    return () => window.clearInterval(interval);
  }, [status?.running, refreshStatus]);

  async function startDiagnosis(): Promise<void> {
    setStarting(true);
    setError(null);
    try {
      await api.post<{ runId: string }>('/api/diagnostics/run');
      await refreshStatus();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to start diagnostics');
    } finally {
      setStarting(false);
    }
  }

  async function downloadReport(): Promise<void> {
    setError(null);
    try {
      await api.download('/api/diagnostics/report', 'kr8bit-diagnostics.json');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to download diagnostic report');
    }
  }

  return (
    <article className="settings-review-card settings-review-card--wide">
      <div className="settings-review-card__heading">
        <div>
          <p className="settings-review-card__eyebrow">Diagnostics</p>
          <h3>Metadata and artwork report</h3>
        </div>
        <span className="settings-review-status"><span />{status?.running ? 'Running' : status?.reportReady ? 'Ready' : 'Idle'}</span>
      </div>
      <p className="settings-review-copy">
        Recheck games with missing metadata or artwork. Uses live providers, makes no library changes, and exports current-state results.
      </p>
      {status?.running && <p className="settings-review-copy" role="status">
        Checking {status.processed}{status.total === null ? '' : ` of ${status.total}`} problem games{status.failed ? ` · ${status.failed} failed` : ''}…
      </p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="scanner-section-actions">
        <button type="button" className="primary" onClick={() => void startDiagnosis()} disabled={starting || status?.running}>
          {starting ? 'starting…' : status?.running ? 'diagnosing…' : 'run diagnostics'}
        </button>
        {status?.reportReady && !status.running && <button type="button" onClick={() => void downloadReport()}>
          download JSON
        </button>}
      </div>
    </article>
  );
}
