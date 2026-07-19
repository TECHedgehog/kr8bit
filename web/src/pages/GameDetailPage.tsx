import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Game, GameUpdateInput } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { MetadataPicker } from '../components/MetadataPicker';
import { formatBytes, formatDateTime, joinStringList, parseStringList, stripArchiveExtension } from '../format';

interface GameDetailPageProps {
  gameId: string;
  onBack: () => void;
}

export function GameDetailPage({ gameId, onBack }: GameDetailPageProps): JSX.Element {
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [form, setForm] = useState<GameUpdateInput>({});

  const fetchGame = useCallback(async () => {
    setError(null);
    try {
      const g = await api.get<Game>(`/api/games/${gameId}`);
      setGame(g);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'failed to load game');
    }
  }, [gameId]);

  useEffect(() => {
    void fetchGame();
  }, [fetchGame]);

  function startEdit() {
    if (!game) return;
    setForm({
      title: game.title ?? '',
      releaseYear: game.releaseYear ?? null,
      description: game.description ?? '',
      developers: game.developers,
      publishers: game.publishers,
      genres: game.genres,
    });
    setEditError(null);
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    setEditError(null);
    try {
      const patch: GameUpdateInput = {
        title: form.title === '' ? null : form.title,
        releaseYear: form.releaseYear === null ? null : Number(form.releaseYear),
        description: form.description === '' ? null : form.description,
        developers: parseStringList((form.developers ?? []).join(',')),
        publishers: parseStringList((form.publishers ?? []).join(',')),
        genres: parseStringList((form.genres ?? []).join(',')),
      };
      await api.patch(`/api/games/${gameId}`, patch);
      setEditing(false);
      await fetchGame();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'save failed');
    } finally {
      setSaving(false);
    }
  }

  async function refreshMetadata() {
    setError(null);
    try {
      await api.post(`/api/games/${gameId}/metadata/refresh`);
      await fetchGame();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'refresh failed');
    }
  }

  async function unlinkMetadata() {
    if (!confirm('Unlink metadata? This will clear all metadata fields.')) return;
    setError(null);
    try {
      await api.del(`/api/games/${gameId}/metadata`);
      await fetchGame();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'unlink failed');
    }
  }

  async function deleteGame() {
    if (!confirm('Delete this game? This cannot be undone.')) return;
    setError(null);
    try {
      await api.del(`/api/games/${gameId}`);
      onBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'delete failed');
    }
  }

  if (error && !game) {
    return (
      <div className="page">
        <PageHeader title="Game" actions={<button onClick={onBack}>back</button>} />
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="page">
        <PageHeader title="Game" actions={<button onClick={onBack}>back</button>} />
        <div className="muted">loading…</div>
      </div>
    );
  }

  const title = game.title ?? game.entryName;
  const hasSteam = game.steamAppId !== null;
  const normalizedQuery = game.title ?? stripArchiveExtension(game.entryName);

  return (
    <div className="page">
      <PageHeader
        title={title}
        actions={
          <div className="page-header-actions">
            <button onClick={onBack}>back</button>
            <button onClick={() => setPickerOpen(true)}>search metadata</button>
            {hasSteam && <button onClick={refreshMetadata}>refresh metadata</button>}
            {hasSteam && <button onClick={unlinkMetadata}>unlink metadata</button>}
            {!editing
              ? <button onClick={startEdit}>edit details</button>
              : <button onClick={saveEdit} disabled={saving}>{saving ? 'saving…' : 'save'}</button>}
            <button className="danger" onClick={deleteGame}>delete game</button>
          </div>
        }
      />

      {error && <div className="error">{error}</div>}

      <div className="detail-layout">
        <div className="detail-cover">
          <img
            src={`/api/games/${game.id}/artwork/header`}
            alt={title}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <img
            src={`/api/games/${game.id}/artwork/cover`}
            alt={title}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        <div className="detail-meta">
          <div className="detail-row">
            <span className="detail-label">status</span>
            <StatusBadge status={game.matchStatus} />
          </div>
          <DetailField label="title" value={game.title ?? '—'} />
          <DetailField label="release year" value={game.releaseYear !== null ? String(game.releaseYear) : '—'} />
          <DetailField label="match score" value={game.matchScore !== null ? `${Math.round(game.matchScore)}%` : '—'} />
          <DetailField label="steam app id" value={game.steamAppId !== null ? String(game.steamAppId) : '—'} />
          <DetailField label="developers" value={joinStringList(game.developers) || '—'} />
          <DetailField label="publishers" value={joinStringList(game.publishers) || '—'} />
          <DetailField label="genres" value={joinStringList(game.genres) || '—'} />
          <DetailField label="entry path" value={game.entryPath} mono />
          <DetailField label="entry name" value={game.entryName} mono />
          <DetailField label="entry type" value={game.entryType} mono />
          <DetailField label="size" value={formatBytes(game.sizeBytes)} mono />
          <DetailField label="matched at" value={formatDateTime(game.matchedAt)} mono />
          <DetailField label="created at" value={formatDateTime(game.createdAt)} mono />
          <DetailField label="updated at" value={formatDateTime(game.updatedAt)} mono />
          <div className="detail-row detail-description">
            <span className="detail-label">description</span>
            <div className="detail-value">{game.description ?? '—'}</div>
          </div>
        </div>
      </div>

      {editing && (
        <section className="card edit-form">
          <h2>Edit details</h2>
          {editError && <div className="error">{editError}</div>}
          <label>
            <span>title</span>
            <input
              type="text"
              value={(form.title as string) ?? ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            <span>release year</span>
            <input
              type="number"
              value={form.releaseYear ?? ''}
              onChange={(e) => setForm({ ...form, releaseYear: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </label>
          <label>
            <span>description</span>
            <textarea
              rows={4}
              value={(form.description as string) ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label>
            <span>developers (comma-separated)</span>
            <input
              type="text"
              value={(form.developers ?? []).join(', ')}
              onChange={(e) => setForm({ ...form, developers: parseStringList(e.target.value) })}
            />
          </label>
          <label>
            <span>publishers (comma-separated)</span>
            <input
              type="text"
              value={(form.publishers ?? []).join(', ')}
              onChange={(e) => setForm({ ...form, publishers: parseStringList(e.target.value) })}
            />
          </label>
          <label>
            <span>genres (comma-separated)</span>
            <input
              type="text"
              value={(form.genres ?? []).join(', ')}
              onChange={(e) => setForm({ ...form, genres: parseStringList(e.target.value) })}
            />
          </label>
          <div className="edit-form-actions">
            <button onClick={saveEdit} disabled={saving}>
              {saving ? 'saving…' : 'save'}
            </button>
            <button onClick={() => setEditing(false)} disabled={saving}>cancel</button>
          </div>
        </section>
      )}

      {pickerOpen && (
        <MetadataPicker
          gameId={gameId}
          initialQuery={normalizedQuery}
          onClose={() => setPickerOpen(false)}
          onAssigned={() => {
            setPickerOpen(false);
            void fetchGame();
          }}
        />
      )}
    </div>
  );
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value${mono ? ' mono' : ''}`}>{value}</span>
    </div>
  );
}