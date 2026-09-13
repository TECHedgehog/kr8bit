import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import type {
  ScanRun,
  ScannerStatus,
} from '../api/types';
import { ScanProgress } from './ScanProgress';
import { formatDateTime } from '../format';

export function ScannerSection(): JSX.Element {
  const [status, setStatus] = useState<ScannerStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [activeScanRunId, setActiveScanRunId] = useState<string | null>(null);
  const statusToken = useRef(0);

  const fetchStatus = useCallback(async () => {
    const token = ++statusToken.current;
    setStatusError(null);
    try {
      const scannerStatus = await api.get<ScannerStatus>('/api/scanner/status');
      if (statusToken.current !== token) return;
      setStatus(scannerStatus);
      if (scannerStatus.isRunning && scannerStatus.runningRun) {
        setActiveScanRunId(scannerStatus.runningRun.id);
      }
    } catch (err) {
      if (statusToken.current !== token) return;
      setStatusError(err instanceof ApiError ? err.message : 'failed to load status');
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  async function startScan() {
    setStarting(true);
    setStartError(null);
    try {
      const response = await api.post<ScanRun>('/api/scanner/run');
      setActiveScanRunId(response.id);
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

  const isRunning = status?.isRunning ?? false;
  const latest = status?.latest ?? null;
  const running = status?.runningRun ?? null;

  return (
    <div className="scanner-section">
      <div className="scanner-section-header">
        <div>
          <p className="eyebrow">Library</p>
          <h3>Scanner</h3>
          <p>Scan installer folders and import games.</p>
        </div>
        <div className="scanner-section-actions">
          <button className="primary" onClick={startScan} disabled={isRunning || starting || !!activeScanRunId}>
            {isRunning || activeScanRunId ? 'scanning…' : starting ? 'starting…' : 'start scan'}
          </button>
        </div>
      </div>

      {startError && <div className="error">{startError}</div>}
      {statusError && <div className="error">{statusError}</div>}

      {activeScanRunId && <ScanProgress scanRunId={activeScanRunId} onDone={onProgressDone} />}

      {running && <section className="card"><h4>Running scan</h4><ScanRunView run={running} /></section>}
      <section className="card">
        <h4>Last scan</h4>
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
      {run.errors.length > 0 && <ul className="scan-run-errors">{run.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    </div>
  );
}
