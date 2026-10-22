import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

interface JobStatus {
  running: boolean;
  processed: number;
  failed: number;
}

interface ConfirmAction {
  id: 'library' | 'repack' | 'artwork-cache';
  title: string;
  description: string;
  confirm: string;
  path: string;
  button: string;
}

const CONFIRM_ACTIONS: ConfirmAction[] = [
  {
    id: 'library',
    title: 'Delete library data',
    description: 'Remove every scanned game, provider match, and scan history. Game files and repack catalog stay untouched.',
    confirm: 'DELETE_LIBRARY',
    path: '/api/maintenance/library/wipe',
    button: 'delete library',
  },
  {
    id: 'repack',
    title: 'Delete repack catalog',
    description: 'Remove all repack posts and games. Library data and repack source settings stay untouched.',
    confirm: 'DELETE_REPACK',
    path: '/api/maintenance/repack/wipe',
    button: 'delete repack catalog',
  },
  {
    id: 'artwork-cache',
    title: 'Clear cached artwork',
    description: 'Delete all cached images. Images are downloaded again as games refresh or artwork is requested.',
    confirm: 'CLEAR_ARTWORK_CACHE',
    path: '/api/maintenance/artwork-cache/clear',
    button: 'clear artwork cache',
  },
];

const JOBS = [
  {
    id: 'metadata' as const,
    title: 'Refresh all metadata',
    description: 'Fetch metadata again for every matched game, regardless of age or missing fields.',
    startPath: '/api/maintenance/metadata/refresh',
    statusPath: '/api/maintenance/metadata/status',
  },
  {
    id: 'artwork' as const,
    title: 'Recheck all artwork',
    description: 'Check every matched game’s saved artwork URLs. Only missing or expired cache files are downloaded.',
    startPath: '/api/maintenance/artwork/recheck',
    statusPath: '/api/maintenance/artwork/status',
  },
];

export function MaintenancePanel(): JSX.Element {
  const [confirmText, setConfirmText] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, JobStatus | null>>({ metadata: null, artwork: null });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatuses = useCallback(async () => {
    const results = await Promise.all(JOBS.map(async (job) => {
      try {
        return [job.id, await api.get<JobStatus>(job.statusPath)] as const;
      } catch {
        return [job.id, null] as const;
      }
    }));
    setStatuses(Object.fromEntries(results));
  }, []);

  useEffect(() => {
    void refreshStatuses();
  }, [refreshStatuses]);

  const anyJobRunning = Object.values(statuses).some((status) => status?.running);
  useEffect(() => {
    if (!anyJobRunning) return;
    const interval = window.setInterval(() => void refreshStatuses(), 1000);
    return () => window.clearInterval(interval);
  }, [anyJobRunning, refreshStatuses]);

  async function runAction(id: string, path: string, body: unknown): Promise<void> {
    setBusy(id);
    setMessage(null);
    setError(null);
    try {
      await api.post(path, body);
      setConfirmText((current) => ({ ...current, [id]: '' }));
      setMessage('Action completed.');
      await refreshStatuses();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Maintenance action failed.');
    } finally {
      setBusy(null);
    }
  }

  async function startJob(job: typeof JOBS[number]): Promise<void> {
    setBusy(job.id);
    setError(null);
    setMessage(null);
    try {
      await api.post(job.startPath);
      await refreshStatuses();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : `Unable to start ${job.title.toLowerCase()}.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="maintenance-panel">
      <section className="settings-subpanel settings-subpanel--first">
        <div className="settings-subpanel-heading"><h3>Refresh</h3></div>
        <p className="settings-help">Runs use live providers. Refreshes can take time and may encounter provider rate limits.</p>
        {JOBS.map((job) => {
          const status = statuses[job.id];
          return <article className="settings-subpanel" key={job.id}>
            <div className="settings-subpanel-heading"><h4>{job.title}</h4><span>{status?.running ? 'Running' : 'Idle'}</span></div>
            <p className="settings-help">{job.description}</p>
            {status?.running && <p role="status">Processed {status.processed}{status.failed ? ` · ${status.failed} failed` : ''}…</p>}
            {!status?.running && status && status.processed > 0 && <p role="status">Last run: {status.processed} processed{status.failed ? ` · ${status.failed} failed` : ''}.</p>}
            <div className="scanner-section-actions">
              <button type="button" className="primary" onClick={() => void startJob(job)} disabled={busy !== null || anyJobRunning}>
                {busy === job.id ? 'starting…' : status?.running ? 'running…' : job.title.toLowerCase()}
              </button>
            </div>
          </article>;
        })}
      </section>

      <section className="settings-subpanel">
        <div className="settings-subpanel-heading"><h3>Delete data</h3></div>
        <p className="settings-help">These actions permanently remove database rows or cached files. They do not delete games from your library folder.</p>
        {CONFIRM_ACTIONS.map((action) => <article className="settings-subpanel" key={action.id}>
          <div className="settings-subpanel-heading"><h4>{action.title}</h4></div>
          <p className="settings-help">{action.description}</p>
          <label className="settings-field">
            <span>Type <code>{action.confirm}</code> to confirm</span>
            <input
              type="text"
              autoComplete="off"
              aria-label={`Confirm ${action.title}`}
              value={confirmText[action.id] ?? ''}
              onChange={(event) => setConfirmText((current) => ({ ...current, [action.id]: event.target.value }))}
            />
          </label>
          <div className="scanner-section-actions">
            <button
              type="button"
              className="danger"
              disabled={busy !== null || confirmText[action.id] !== action.confirm}
              onClick={() => void runAction(action.id, action.path, { confirm: action.confirm })}
            >
              {busy === action.id ? 'working…' : action.button}
            </button>
          </div>
        </article>)}
      </section>
      {message && <p role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
