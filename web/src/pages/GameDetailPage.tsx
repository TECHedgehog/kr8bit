import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Search, RefreshCw, Unlink, Trash2, Save, X,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Game, GameUpdateInput } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { MetadataPicker } from '../components/MetadataPicker';
import { IconButton } from '../components/IconButton';
import { useToast } from '../context/ToastContext';
import { formatBytes, formatDateTime, joinStringList, parseStringList, stripArchiveExtension } from '../format';

export function GameDetailPage(): JSX.Element {
  const { id: gameId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [form, setForm] = useState<GameUpdateInput>({});
  const [heroError, setHeroError] = useState(false);
  const [coverError, setCoverError] = useState(false);

  const fetchGame = useCallback(async () => {
    if (!gameId) return;
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
    if (!gameId) return;
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
      toast.success('Game details saved');
      await fetchGame();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'save failed');
      toast.error('Failed to save game details');
    } finally {
      setSaving(false);
    }
  }

  async function refreshMetadata() {
    if (!gameId) return;
    try {
      await api.post(`/api/games/${gameId}/metadata/refresh`);
      toast.success('Metadata refreshed');
      await fetchGame();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'refresh failed');
    }
  }

  async function unlinkMetadata() {
    if (!gameId) return;
    if (!confirm('Unlink metadata? This will clear all metadata fields.')) return;
    try {
      await api.del(`/api/games/${gameId}/metadata`);
      toast.success('Metadata unlinked');
      await fetchGame();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'unlink failed');
    }
  }

  async function deleteGame() {
    if (!gameId) return;
    if (!confirm('Delete this game? This cannot be undone.')) return;
    try {
      await api.del(`/api/games/${gameId}`);
      toast.success('Game deleted');
      navigate('/games');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'delete failed');
    }
  }

  if (error && !game) {
    return (
      <div className="page">
        <div className="error">{error}</div>
        <IconButton icon={ArrowLeft} label="Back to library" onClick={() => navigate('/games')} />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="page">
        <div className="muted">Loading…</div>
      </div>
    );
  }

  const title = game.title ?? game.entryName;
  const hasSteam = game.steamAppId !== null;
  const normalizedQuery = game.title ?? stripArchiveExtension(game.entryName);

  return (
    <div className="detail-page">
      <div className="detail-hero">
        {heroError ? (
          <div className="detail-hero-placeholder" />
        ) : (
          <img
            className="detail-hero-image"
            src={`/api/games/${game.id}/artwork/header`}
            alt={title}
            onError={() => setHeroError(true)}
          />
        )}
        <div className="detail-hero-overlay" />
        <div className="detail-hero-content">
          <h1 className="detail-hero-title">{title}</h1>
          <div className="detail-hero-subtitle">
            <StatusBadge status={game.matchStatus} />
            {game.releaseYear && <span>{game.releaseYear}</span>}
            {game.sizeBytes > 0 && <span>{formatBytes(game.sizeBytes)}</span>}
          </div>
        </div>
      </div>

      <div className="detail-toolbar">
        <IconButton icon={ArrowLeft} label="Back to library" onClick={() => navigate('/games')} />
        <div className="toolbar-spacer" />
        <IconButton
          icon={Search}
          label="Search metadata"
          onClick={() => setPickerOpen(true)}
        />
        {hasSteam && (
          <IconButton icon={RefreshCw} label="Refresh metadata" onClick={refreshMetadata} />
        )}
        {hasSteam && (
          <IconButton icon={Unlink} label="Unlink metadata" onClick={unlinkMetadata} variant="danger" />
        )}
        {!editing ? (
          <IconButton icon={Pencil} label="Edit details" onClick={startEdit} />
        ) : (
          <>
            <IconButton icon={Save} label="Save changes" onClick={saveEdit} disabled={saving} />
            <IconButton icon={X} label="Cancel edit" onClick={() => setEditing(false)} disabled={saving} ghost />
          </>
        )}
        <div className="toolbar-divider" />
        <IconButton icon={Trash2} label="Delete game" onClick={deleteGame} variant="danger" />
      </div>

      <div className="detail-content">
        {error && <div className="error">{error}</div>}

        {editing && (
          <section className="card edit-form">
            <h2>Edit details</h2>
            {editError && <div className="error">{editError}</div>}
            <label>
              <span>Title</span>
              <input
                type="text"
                value={(form.title as string) ?? ''}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              <span>Release year</span>
              <input
                type="number"
                value={form.releaseYear ?? ''}
                onChange={(e) => setForm({ ...form, releaseYear: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                rows={4}
                value={(form.description as string) ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <label>
              <span>Developers (comma-separated)</span>
              <input
                type="text"
                value={(form.developers ?? []).join(', ')}
                onChange={(e) => setForm({ ...form, developers: parseStringList(e.target.value) })}
              />
            </label>
            <label>
              <span>Publishers (comma-separated)</span>
              <input
                type="text"
                value={(form.publishers ?? []).join(', ')}
                onChange={(e) => setForm({ ...form, publishers: parseStringList(e.target.value) })}
              />
            </label>
            <label>
              <span>Genres (comma-separated)</span>
              <input
                type="text"
                value={(form.genres ?? []).join(', ')}
                onChange={(e) => setForm({ ...form, genres: parseStringList(e.target.value) })}
              />
            </label>
            <div className="edit-form-actions">
              <button className="primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            </div>
          </section>
        )}

        {!editing && (
          <>
            <section className="detail-section">
              <div className="detail-section-title">Information</div>
              <div className="detail-meta">
                <DetailField label="Title" value={game.title ?? '—'} />
                <DetailField label="Release Year" value={game.releaseYear !== null ? String(game.releaseYear) : '—'} />
                <DetailField label="Status" value={<StatusBadge status={game.matchStatus} />} />
                <DetailField label="Match Score" value={game.matchScore !== null ? `${Math.round(game.matchScore)}%` : '—'} />
                <DetailField label="Steam App ID" value={game.steamAppId !== null ? String(game.steamAppId) : '—'} />
                <DetailField label="Developers" value={joinStringList(game.developers) || '—'} />
                <DetailField label="Publishers" value={joinStringList(game.publishers) || '—'} />
                <DetailField label="Genres" value={joinStringList(game.genres) || '—'} />
              </div>
            </section>

            {game.description && (
              <section className="detail-section">
                <div className="detail-section-title">Description</div>
                <div className="detail-description-text">{game.description}</div>
              </section>
            )}

            <section className="detail-section">
              <div className="detail-section-title">File Details</div>
              <div className="detail-meta">
                <DetailField label="Entry Path" value={game.entryPath} mono />
                <DetailField label="Entry Name" value={game.entryName} mono />
                <DetailField label="Entry Type" value={game.entryType} mono />
                <DetailField label="Size" value={formatBytes(game.sizeBytes)} mono />
                <DetailField label="Matched At" value={formatDateTime(game.matchedAt)} mono />
                <DetailField label="Created At" value={formatDateTime(game.createdAt)} mono />
                <DetailField label="Updated At" value={formatDateTime(game.updatedAt)} mono />
              </div>
            </section>

            {!coverError && (
              <section className="detail-section">
                <div className="detail-section-title">Cover Art</div>
                <img
                  src={`/api/games/${game.id}/artwork/cover`}
                  alt={`${title} cover`}
                  onError={() => setCoverError(true)}
                  style={{ maxWidth: '300px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
                />
              </section>
            )}
          </>
        )}
      </div>

      {pickerOpen && (
        <MetadataPicker
          gameId={gameId!}
          initialQuery={normalizedQuery}
          onClose={() => setPickerOpen(false)}
          onAssigned={() => {
            setPickerOpen(false);
            toast.success('Metadata assigned');
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
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value${mono ? ' mono' : ''}`}>{value}</span>
    </div>
  );
}