import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { GameRenamePreview } from '../api/types';

const DEFAULT_FORMAT = '{title} ({year}) [{edition}]';
const TAGS = '{title} {year} {edition} {platform} {version} {dlcs} {group} {original}';

export function LibraryNamingSection(): JSX.Element {
  const [format, setFormat] = useState('');
  const [savedFormat, setSavedFormat] = useState('');
  const [preview, setPreview] = useState<GameRenamePreview[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.get<{ kv: { key: string; value: string }[] }>('/api/settings').then((settings) => {
      const saved = settings.kv.find((entry) => entry.key === 'libraryRenameCustomFormat')?.value ?? '';
      setFormat(saved);
      setSavedFormat(saved);
    }).catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'failed to load naming settings'));
  }, []);

  function validateFormat(): boolean {
    const supported = new Set(['title', 'year', 'edition', 'platform', 'version', 'dlcs', 'group', 'original']);
    for (const match of format.matchAll(/\{([^}]+)\}/g)) {
      if (!supported.has(match[1].toLowerCase())) {
        setError(`unsupported filename tag: ${match[1]}`);
        return false;
      }
    }
    return true;
  }

  async function save() {
    if (!validateFormat()) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const value = format.trim();
      await api.put('/api/settings', { libraryRenameCustomFormat: value });
      setFormat(value); setSavedFormat(value); setMessage('Naming format saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'failed to save naming format');
    } finally { setSaving(false); }
  }

  async function startPreview() {
    if (!validateFormat()) return;
    setProcessing(true); setError(null); setMessage(null);
    try {
      const result = await api.post<{ items: GameRenamePreview[] }>('/api/games/rename/preview', { format });
      setPreview(result.items);
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
      const result = await api.post<Array<{ status: string }>>('/api/games/rename', { ids, format });
      const failed = result.filter((item) => item.status === 'failed').length;
      setMessage(`${result.length - failed} renamed${failed ? `, ${failed} failed` : ''}`);
      setPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'rename failed');
    } finally { setProcessing(false); }
  }

  const readyCount = preview?.filter((item) => item.status === 'ready' && !excluded.has(item.id)).length ?? 0;

  return <div className="settings-subpanel settings-subpanel--first">
    <p>Rename supported files and folders from this panel.</p>
    <div className="filename-format-control">
      <label><span>Filename format</span><div className="filename-format-field"><input value={format} onChange={(event) => setFormat(event.target.value)} placeholder={DEFAULT_FORMAT} /><small>Tags: {TAGS}</small></div></label>
      {format.trim() !== savedFormat && <button type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>}
    </div>
    {!preview && <button type="button" onClick={() => void startPreview()} disabled={processing}>{processing ? 'Preparing…' : 'Start manual rename'}</button>}
    {preview && <>
      <div className="rename-preview-log" role="log" aria-label="Rename preview">
        {preview.map((item) => <label className={`rename-preview-row rename-preview-row--${item.status}`} key={item.id}>
          <input type="checkbox" checked={!excluded.has(item.id)} disabled={item.status !== 'ready'} onChange={(event) => setExcluded((current) => { const next = new Set(current); if (event.target.checked) next.delete(item.id); else next.add(item.id); return next; })} />
          <span><span className="rename-preview-old">{item.oldName}</span><span className="rename-preview-arrow"> → </span><span className="rename-preview-new">{item.newName ?? item.message}</span></span>
        </label>)}
      </div>
      <div className="rename-preview-actions">
        <button type="button" onClick={() => setPreview(null)} disabled={processing}>Cancel</button>
        <button type="button" onClick={() => void applyRename()} disabled={processing || readyCount === 0}>{processing ? 'Renaming…' : `Accept renaming (${readyCount})`}</button>
      </div>
    </>}
    {message && <div>{message}</div>}
    {error && <div className="error">{error}</div>}
  </div>;
}
