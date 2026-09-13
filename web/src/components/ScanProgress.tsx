import { useEffect, useRef, useState } from 'react';
import type { ScanProgressEvent } from '../api/types';

interface ScanProgressProps {
  scanRunId: string | null;
  onDone: () => void;
  onEvent?: (event: ScanProgressEvent) => void;
}

type ProgressStage = 'scan' | 'metadata' | 'artwork';
type StageProgress = Record<ProgressStage, { completed: number; total: number }>;

const EMPTY_PROGRESS: StageProgress = {
  scan: { completed: 0, total: 0 },
  metadata: { completed: 0, total: 0 },
  artwork: { completed: 0, total: 0 },
};

const STAGE_LABELS: Record<ProgressStage, string> = {
  scan: 'Scanning',
  metadata: 'Metadata',
  artwork: 'Artwork',
};

export function ScanProgress({ scanRunId, onDone, onEvent }: ScanProgressProps) {
  const [event, setEvent] = useState<ScanProgressEvent | null>(null);
  const [progress, setProgress] = useState<StageProgress>(EMPTY_PROGRESS);
  const [connError, setConnError] = useState(false);
  const doneFiredRef = useRef(false);

  useEffect(() => {
    if (!scanRunId) {
      setEvent(null);
      setProgress(EMPTY_PROGRESS);
      setConnError(false);
      doneFiredRef.current = false;
      return;
    }
    doneFiredRef.current = false;
    setConnError(false);
    setProgress(EMPTY_PROGRESS);
    let doneTimer: number | undefined;
    const source = new EventSource('/api/scanner/progress');
    source.onmessage = (msg) => {
      const data = msg.data as string;
      if (!data || data.startsWith(':')) return;
      try {
        const parsed = JSON.parse(data) as ScanProgressEvent;
        if (parsed.scanRunId !== scanRunId) return;
        setEvent(parsed);
        onEvent?.(parsed);
        if (parsed.stage && parsed.stage !== 'done' && parsed.total !== undefined && parsed.completed !== undefined) {
          setProgress((current) => ({
            ...current,
            [parsed.stage as ProgressStage]: { completed: parsed.completed!, total: parsed.total! },
          }));
        }
        if (parsed.stage === 'done') {
          setProgress((current) => ({
            scan: { ...current.scan, completed: current.scan.total },
            metadata: { ...current.metadata, completed: current.metadata.total },
            artwork: { ...current.artwork, completed: current.artwork.total },
          }));
        }
        setConnError(false);
        if (parsed.phase === 'done' && !doneFiredRef.current) {
          doneFiredRef.current = true;
          doneTimer = window.setTimeout(onDone, 500);
        }
      } catch {
        // ignore malformed
      }
    };
    source.onerror = () => {
      // EventSource auto-reconnects; surface the outage instead of failing
      // silently so a stuck scan doesn't look like a frozen UI.
      setConnError(true);
    };
    return () => {
      if (doneTimer !== undefined) window.clearTimeout(doneTimer);
      source.close();
    };
  }, [scanRunId, onDone, onEvent]);

  if (!scanRunId) return null;
  if (!event) {
    return <div className="scan-progress"><span className="scan-progress-label">Connecting to scanner…</span></div>;
  }

  return (
    <div className="scan-progress">
      <div className="scan-progress-stages">
        {(Object.keys(STAGE_LABELS) as ProgressStage[]).map((stage) => {
          const value = progress[stage];
          const percent = value.total > 0 ? Math.min(100, (value.completed / value.total) * 100) : 0;
          return <div className="scan-progress-stage" key={stage}>
            <div className="scan-progress-stage-label"><span>{STAGE_LABELS[stage]}</span><strong>{value.total > 0 ? `${Math.round(percent)}%` : 'waiting'}</strong></div>
            <div className={`scan-progress-track scan-progress-track--${stage}`} role="progressbar" aria-label={`${STAGE_LABELS[stage]} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span style={{ width: `${percent}%` }} /></div>
          </div>;
        })}
      </div>
      {connError && (
        <div className="scan-progress-message error">connection lost — reconnecting…</div>
      )}
    </div>
  );
}
