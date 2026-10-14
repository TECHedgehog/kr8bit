import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { GameRenamePreview, GameRenameResult } from '../api/types';

const DEFAULT_FORMAT = '{title} ({year}) [{edition}]';
const TAGS = '{title} {year} {edition} {platform} {version} {dlcs} {group} {original}';
const RENAME_STATUS_LABELS: Record<Exclude<GameRenamePreview['status'], 'ready'>, string> = {
  unchanged: 'Unchanged', conflict: 'Conflict', unavailable: 'Unavailable', renamed: 'Renamed', failed: 'Failed',
};

export function LibraryNamingSection(): JSX.Element {
  const [format, setFormat] = useState('');
  const [savedFormat, setSavedFormat] = useState('');
  const [preview, setPreview] = useState<GameRenamePreview[] | null>(null);
  const [previewFormat, setPreviewFormat] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [hasApplied, setHasApplied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestToken = useRef(0);
  useEffect(() => {
    let mounted = true;
    const token = ++requestToken.current;
    void api.get<{ kv: { key: string; value: string }[] }>('/api/settings').then((settings) => {
      if (!mounted || requestToken.current !== token) return;
      const saved = settings.kv.find((entry) => entry.key === 'libraryRenameCustomFormat')?.value ?? '';
      setFormat(saved);
      setSavedFormat(saved);
    }).catch((err: unknown) => {
      if (mounted && requestToken.current === token) setError(err instanceof ApiError ? err.message : 'failed to load naming settings');
    });
    return () => { mounted = false; };
  }, []);

  async function save() {
    setSaving(true); setError(null); setMessage(null);
    try {
      const value = format.trim();
      await api.put('/api/settings', { libraryRenameCustomFormat: value });
      setFormat(value); setSavedFormat(value); setMessage('Naming format saved');
      setPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'failed to save naming format');
    } finally { setSaving(false); }
  }

  async function startPreview() {
    setProcessing(true); setError(null); setMessage(null);
    const requestedFormat = format.trim();
    try {
      const result = await api.post<{ items: GameRenamePreview[] }>('/api/games/rename/preview', { format: requestedFormat });
      setPreview(result.items);
      setPreviewFormat(requestedFormat);
      setHasApplied(false);
      setExcluded(new Set(result.items.filter((item) => item.status !== 'ready').map((item) => item.id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'failed to create rename preview');
    } finally { setProcessing(false); }
  }

  async function applyRename() {
    if (!preview) return;
    const ids = preview.filter((item) => item.status === 'ready' && !excluded.has(item.id)).map((item) => item.id);
    if (ids.length === 0) return;
    setProcessing(true); setError(null); setMessage(null);
    try {
      const result = await api.post<GameRenameResult[]>('/api/games/rename', { ids, format: previewFormat });
      const failed = result.filter((item) => item.status === 'failed').length;
      setMessage(`${result.length - failed} renamed${failed ? `, ${failed} failed` : ''}`);
      const byId = new Map(result.map((item) => [item.id, item]));
      setPreview((items) => items?.map((item) => {
        const outcome = byId.get(item.id);
        if (!outcome) return item;
        return {
          ...item,
          status: outcome.status === 'renamed' ? 'renamed' : outcome.status === 'failed' ? 'failed' : 'unchanged',
          newName: outcome.newPath?.split(/[\\/]/).pop() ?? item.newName,
          message: outcome.message,
        };
      }) ?? null);
      setHasApplied(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'rename failed');
    } finally { setProcessing(false); }
  }

  const readyCount = preview?.filter((item) => item.status === 'ready' && !excluded.has(item.id)).length ?? 0;

  return <div className="settings-subpanel settings-subpanel--first">
    <div className="filename-format-control">
      <label><span>Filename format</span><div className="filename-format-field"><input value={format} onChange={(event) => { setFormat(event.target.value); setPreview(null); setError(null); }} placeholder={DEFAULT_FORMAT} disabled={processing || saving} /><small>Tags: {TAGS}</small></div></label>
      {format.trim() !== savedFormat.trim() && <button type="button" onClick={() => void save()} disabled={saving || processing}>{saving ? 'Saving…' : 'Save'}</button>}
    </div>
    {!preview && <button type="button" className="primary" onClick={() => void startPreview()} disabled={processing}>{processing ? 'Preparing…' : 'Start manual rename'}</button>}
    {preview && <>
      <div className="rename-preview-log" role="log" aria-label="Rename preview">
        {preview.map((item) => <label className={`rename-preview-row rename-preview-row--${item.status}`} key={item.id}>
          <input type="checkbox" checked={!excluded.has(item.id)} disabled={item.status !== 'ready'} onChange={(event) => setExcluded((current) => { const next = new Set(current); if (event.target.checked) next.delete(item.id); else next.add(item.id); return next; })} />
          <span className="rename-preview-names"><span className="rename-preview-old">{item.oldName}</span><span className="rename-preview-arrow"> → </span><span className="rename-preview-new">{item.newName ?? '—'}</span></span>
          {item.status !== 'ready' && <span className="rename-preview-details">
            <span className={`rename-preview-status rename-preview-status--${item.status}`}>{RENAME_STATUS_LABELS[item.status]}</span>
            {item.message && <span className="rename-preview-reason">{item.message}</span>}
          </span>}
        </label>)}
      </div>
      <div className="rename-preview-actions">
        <button type="button" onClick={() => setPreview(null)} disabled={processing}>Cancel</button>
        {hasApplied && <button type="button" onClick={() => void startPreview()} disabled={processing}>Refresh preview</button>}
        <button type="button" className="primary" onClick={() => void applyRename()} disabled={processing || hasApplied || readyCount === 0}>{processing ? 'Renaming…' : `Accept renaming (${readyCount})`}</button>
      </div>
    </>}
    {message && <div aria-live="polite">{message}</div>}
    {error && <div className="error" role="alert">{error}</div>}
  </div>;
}
