import { useEffect, useRef, useState } from 'react';
import type { ScanProgressEvent } from '../api/types';

interface ScanProgressProps {
  scanRunId: string | null;
  onDone: () => void;
}

export function ScanProgress({ scanRunId, onDone }: ScanProgressProps) {
  const [event, setEvent] = useState<ScanProgressEvent | null>(null);
  const doneFiredRef = useRef(false);

  useEffect(() => {
    if (!scanRunId) {
      setEvent(null);
      doneFiredRef.current = false;
      return;
    }
    doneFiredRef.current = false;
    let doneTimer: number | undefined;
    const source = new EventSource('/api/scanner/progress');
    source.onmessage = (msg) => {
      const data = msg.data as string;
      if (!data || data.startsWith(':')) return;
      try {
        const parsed = JSON.parse(data) as ScanProgressEvent;
        if (parsed.scanRunId !== scanRunId) return;
        setEvent(parsed);
        if (parsed.phase === 'done' && !doneFiredRef.current) {
          doneFiredRef.current = true;
          doneTimer = window.setTimeout(onDone, 500);
        }
      } catch {
        // ignore malformed
      }
    };
    source.onerror = () => {
      // EventSource auto-reconnects; ignore transient errors
    };
    return () => {
      if (doneTimer !== undefined) window.clearTimeout(doneTimer);
      source.close();
    };
  }, [scanRunId, onDone]);

  if (!scanRunId) return null;
  if (!event) {
    return <div className="scan-progress">connecting…</div>;
  }

  return (
    <div className="scan-progress">
      <div className="scan-progress-phase">phase: {event.phase}</div>
      {event.currentEntry && (
        <div className="scan-progress-entry" title={event.currentEntry}>
          entry: {event.currentEntry}
        </div>
      )}
      {event.message && <div className="scan-progress-message">{event.message}</div>}
      <div className="scan-progress-counts">
        <span>found: {event.found}</span>
        <span>added: {event.added}</span>
        <span>updated: {event.updated}</span>
        <span>failed: {event.failed}</span>
      </div>
    </div>
  );
}