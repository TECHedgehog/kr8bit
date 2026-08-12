import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { ScanRun, ScannerStatus, JobState } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { ScanProgress } from '../components/ScanProgress';
import { formatDateTime } from '../format';

export function ScanPage(): JSX.Element {
  const [status, setStatus] = useState<ScannerStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [activeScanRunId, setActiveScanRunId] = useState<string | null>(null);

  const [refreshState, setRefreshState] = useState<JobState | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [retryState, setRetryState] = useState<JobState | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setStatusError(null);
    try {
      const s = await api.get<ScannerStatus>('/api/scanner/status');
      setStatus(s);
      if (s.isRunning && s.running) {
        setActiveScanRunId(s.running.id);
      }
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : 'failed to load status');
    }
  }, []);

  const fetchRefreshStatus = useCallback(async () => {
    try {
      const res = await api.get<{ running: boolean; state: JobState }>('/api/metadata/refresh-all/status');
      setRefreshState(res.state);
      if (!res.running) {
        setRefreshState(null);
      }
    } catch {
      // ignore polling errors
    }
  }, []);

  const fetchRetryStatus = useCallback(async () => {
    try {
      const res = await api.get<{ running: boolean; state: JobState }>('/api/metadata/retry-matches/status');
      setRetryState(res.state);
      if (!res.running) {
        setRetryState(null);
      }
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    void fetchRefreshStatus();
    void fetchRetryStatus();
  }, [fetchStatus, fetchRefreshStatus, fetchRetryStatus]);

  useEffect(() => {
    if (!refreshState) return;
    const id = setInterval(fetchRefreshStatus, 1500);
    return () => clearInterval(id);
  }, [refreshState, fetchRefreshStatus]);

  useEffect(() => {
    if (!retryState) return;
    const id = setInterval(fetchRetryStatus, 1500);
    return () => clearInterval(id);
  }, [retryState, fetchRetryStatus]);

  async function startScan() {
    setStarting(true);
    setStartError(null);
    try {
      const res = await api.post<ScanRun>('/api/scanner/run');
      setActiveScanRunId(res.id);
      void fetchStatus();
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : 'failed to start scan');
    } finally {
      setStarting(false);
    }
  }

  const onProgressDone = useCallback(() => {
    void fetchStatus();
    setActiveScanRunId(null);
  }, [fetchStatus]);

  async function handleRetryMatches() {
    setRetryError(null);
    try {
      await api.post('/api/metadata/retry-matches');
      setRetryState({ running: true, processed: 0, failed: 0 });
    } catch (err) {
      setRetryError(err instanceof ApiError ? err.message : 'failed to start retry');
    }
  }

  async function handleRefreshAll() {
    setRefreshError(null);
    try {
      await api.post('/api/metadata/refresh-all');
      setRefreshState({ running: true, processed: 0, failed: 0 });
    } catch (err) {
      setRefreshError(err instanceof ApiError ? err.message : 'failed to start refresh');
    }
  }

  const isRunning = status?.isRunning ?? false;
  const latest = status?.latest ?? null;
  const running = status?.running ?? null;

  return (
    <div className="page">
      <PageHeader
        title="Scanner"
        subtitle="Scan installer folders and import games"
        actions={
          <>
            <button
              className="primary"
              onClick={startScan}
              disabled={isRunning || starting || !!activeScanRunId}
            >
              {isRunning || activeScanRunId
                ? 'scanning…'
                : starting
                  ? 'starting…'
                  : 'start scan'}
            </button>
            <button
              onClick={handleRetryMatches}
              disabled={!!retryState}
            >
              {retryState ? 'retrying…' : 'retry metadata search'}
            </button>
            <button
              onClick={handleRefreshAll}
              disabled={!!refreshState}
            >
              {refreshState ? 'refreshing…' : 'refresh metadata'}
            </button>
          </>
        }
      />
      {startError && <div className="error">{startError}</div>}
      {statusError && <div className="error">{statusError}</div>}
      {retryError && <div className="error">{retryError}</div>}
      {refreshError && <div className="error">{refreshError}</div>}

      {retryState && (
        <div className="card">
          <div className="job-banner">
            <span>retrying metadata search: {retryState.processed} processed, {retryState.failed} failed</span>
          </div>
        </div>
      )}

      {refreshState && (
        <div className="card">
          <div className="job-banner">
            <span>refreshing metadata: {refreshState.processed} processed, {refreshState.failed} failed</span>
          </div>
        </div>
      )}

      {activeScanRunId && (
        <ScanProgress scanRunId={activeScanRunId} onDone={onProgressDone} />
      )}

      {running && (
        <section className="card">
          <h2>Running scan</h2>
          <ScanRunView run={running} />
        </section>
      )}

      <section className="card">
        <h2>Last scan</h2>
        {latest ? <ScanRunView run={latest} /> : <p>no scans yet</p>}
      </section>
    </div>
  );
}

function ScanRunView({ run }: { run: ScanRun }): JSX.Element {
  return (
    <div className="scan-run">
      <div className="scan-run-row"><span>id</span><code>{run.id}</code></div>
      <div className="scan-run-row"><span>root</span><code>{run.rootPath}</code></div>
      <div className="scan-run-row"><span>status</span><code>{run.status}</code></div>
      <div className="scan-run-row"><span>started</span><code>{formatDateTime(run.startedAt)}</code></div>
      <div className="scan-run-row"><span>finished</span><code>{formatDateTime(run.finishedAt)}</code></div>
      <div className="scan-run-counts">
        <span>found: {run.found}</span>
        <span>added: {run.added}</span>
        <span>updated: {run.updated}</span>
        <span>failed: {run.failed}</span>
      </div>
      {run.errors.length > 0 && (
        <ul className="scan-run-errors">
          {run.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

