import { useCallback, useEffect, useRef, useState } from 'react';
import IconInfoCircle from '@tabler/icons-react/dist/esm/icons/IconInfoCircle.mjs';
import { api, ApiError } from '../api/client';
import type {
  ScanRun,
  ScanProgressEvent,
  ScannerStatus,
} from '../api/types';
import { ScanProgress } from './ScanProgress';
import { formatDateTime } from '../format';

export function ScannerSection(): JSX.Element {
  const [status, setStatus] = useState<ScannerStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const [activeScanRunId, setActiveScanRunId] = useState<string | null>(null);
  const [liveProgress, setLiveProgress] = useState<ScanProgressEvent | null>(null);
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

  useEffect(() => {
    if (!activeScanRunId) return;
    const poll = window.setInterval(() => {
      void fetchStatus();
    }, 1000);
    return () => window.clearInterval(poll);
  }, [activeScanRunId, fetchStatus]);

  useEffect(() => {
    if (!activeScanRunId || !status || status.isRunning || status.latest?.id !== activeScanRunId) return;
    setLiveProgress(null);
    setActiveScanRunId(null);
    setStopping(false);
  }, [activeScanRunId, status]);

  async function startScan() {
    setStarting(true);
    setStartError(null);
    try {
      const response = await api.post<ScanRun>('/api/scanner/run');
      setLiveProgress(null);
      setActiveScanRunId(response.id);
      void fetchStatus();
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : 'failed to start scan');
    } finally {
      setStarting(false);
    }
  }

  async function stopScan() {
    if (!activeScanRunId) return;
    setStopping(true);
    setStopError(null);
    try {
      await api.post<{ stopping: boolean }>(`/api/scanner/run/${activeScanRunId}/stop`);
      void fetchStatus();
    } catch (err) {
      setStopError(err instanceof ApiError ? err.message : 'failed to stop scan');
      setStopping(false);
    }
  }

  const onProgressDone = useCallback(() => {
    void fetchStatus();
    setLiveProgress(null);
    setActiveScanRunId(null);
    setStopping(false);
  }, [fetchStatus]);

  const isRunning = status?.isRunning ?? false;
  const latest = status?.latest ?? null;
  const running = status?.runningRun ?? null;
  const activeRun = running ?? latest;
  const liveRun = running ?? latest;
  const showLivePanel = activeScanRunId !== null;

  return (
    <div className="scanner-section">
      {!showLivePanel && <div className="scanner-section-header">
        <div className="scanner-status-line">
          <span className={`scanner-status${isRunning ? ' is-running' : ''}`}><span />{isRunning ? 'Scanning now' : 'Ready to scan'}</span>
          {activeRun?.rootPath && <LocationInfo path={activeRun.rootPath} />}
        </div>
        <ScanAction starting={starting} stopping={stopping} isRunning={isRunning} activeScanRunId={activeScanRunId} onStart={startScan} onStop={stopScan} />
      </div>}

      {startError && <div className="error">{startError}</div>}
      {stopError && <div className="error">{stopError}</div>}
      {statusError && <div className="error">{statusError}</div>}

      {showLivePanel && <section className="scanner-card scanner-card--active scanner-current-card">
        <div className="scanner-card-heading scanner-current-heading">
          <div>
            <div className="scanner-status-line">
              <span className="scanner-status is-running"><span />Current scan</span>
              {liveRun?.rootPath && <LocationInfo path={liveRun.rootPath} />}
            </div>
            <p className="scanner-current-entry" title={liveProgress?.currentEntry}>{liveProgress?.currentEntry ?? 'Preparing scanner…'}</p>
          </div>
          <div className="scanner-current-actions">
            <span>Live</span>
            <ScanAction starting={starting} stopping={stopping} isRunning={isRunning} activeScanRunId={activeScanRunId} onStart={startScan} onStop={stopScan} />
          </div>
        </div>
        <ScanProgress scanRunId={activeScanRunId} onDone={onProgressDone} onEvent={setLiveProgress} />
        <ScanMetrics run={liveRun} progress={liveProgress} />
      </section>}

      <section className="scanner-card">
        <div className="scanner-card-heading"><h3>Recent activity</h3>{latest && <span>{formatDateTime(latest.finishedAt ?? latest.startedAt)}</span>}</div>
        {latest ? <ScanRunView run={latest} /> : <p className="scanner-empty">No scans yet</p>}
      </section>
    </div>
  );
}

function ScanRunView({ run }: { run: ScanRun }): JSX.Element {
  return <ScanMetrics run={run} />;
}

function ScanMetrics({ run, progress }: { run: ScanRun | null; progress?: ScanProgressEvent | null }): JSX.Element {
  const status = progress?.phase ?? run?.status ?? 'starting';
  const found = progress?.found ?? run?.found ?? 0;
  const added = progress?.added ?? run?.added ?? 0;
  const updated = progress?.updated ?? run?.updated ?? 0;
  const failed = progress?.failed ?? run?.failed ?? 0;

  return (
    <div className="scan-run">
      <div className="scan-run-summary">
        <div><strong>{status}</strong><span>status</span></div>
        <div><strong>{found}</strong><span>found</span></div>
        <div><strong>{added}</strong><span>added</span></div>
        <div><strong>{updated}</strong><span>updated</span></div>
        <div><strong>{failed}</strong><span>failed</span></div>
      </div>
      {run && <div className="scan-run-meta"><span>started {formatDateTime(run.startedAt)}</span><span>finished {formatDateTime(run.finishedAt)}</span></div>}
      {run && run.errors.length > 0 && <ul className="scan-run-errors">{run.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    </div>
  );
}

function LocationInfo({ path }: { path: string }): JSX.Element {
  return <span className="scanner-location-info">
    <button type="button" aria-label="Show configured library path" aria-describedby="scanner-location-path"><IconInfoCircle size={16} stroke={1.8} aria-hidden="true" /></button>
    <span id="scanner-location-path" role="tooltip">{path}</span>
  </span>;
}

function ScanAction({ starting, stopping, isRunning, activeScanRunId, onStart, onStop }: { starting: boolean; stopping: boolean; isRunning: boolean; activeScanRunId: string | null; onStart: () => void; onStop: () => void }): JSX.Element {
  const active = isRunning || activeScanRunId !== null;
  return <div className="scanner-section-actions">
    {active ? <button className="danger" onClick={onStop} disabled={stopping}>
      {stopping ? 'stopping…' : 'stop scan'}
    </button> : <button className="primary" onClick={onStart} disabled={starting}>
      {starting ? 'starting…' : 'scan now'}
    </button>}
  </div>;
}
