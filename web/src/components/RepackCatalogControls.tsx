import type { RepackCatalogSettings, RepackJobStatus } from '../api/types';

export function RepackCatalogControls({
  settings, status, working, onRun,
}: {
  settings: RepackCatalogSettings | null;
  status: RepackJobStatus | null;
  working: boolean;
  onRun: (kind: 'recent' | 'archive' | 'audit') => void;
}): JSX.Element {
  return (
    <div className="repack-catalog-controls">
      <span className="panel-label">Catalog source</span>
      <div className="repack-source-status" role="status">
        <span className={`repack-status__dot${status?.running ? ' is-running' : ''}`} />
        {status?.running ? `${status.phase}: ${status.processed}/${status.total}` : settings?.enabled ? 'FitGirl source ready' : 'FitGirl source disabled'}
      </div>
      {!settings?.enabled && <p className="muted">Enable source in settings before syncing.</p>}
      <div className="repack-catalog-controls__actions">
        <button type="button" onClick={() => onRun('recent')} disabled={!settings?.enabled || working || status?.running}>Sync recent</button>
        <button type="button" onClick={() => onRun('archive')} disabled={!settings?.enabled || working || status?.running}>
          {settings?.fullImportComplete ? 'Check full archive' : 'Import full archive'}
        </button>
        <button type="button" onClick={() => onRun('audit')} disabled={!settings?.enabled || working || status?.running || !settings?.auditEnabled}>Audit history</button>
      </div>
      {status?.startedAt && <small className="muted">Last job started {new Date(status.startedAt).toLocaleString()}</small>}
    </div>
  );
}
