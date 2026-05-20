import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, HardDrive, Download, FolderOpen, File, Gamepad2,
  CheckCircle2, Trash2, Loader2, AlertCircle,
} from 'lucide-react'
import { useLibraryEntry, useLibraryFiles, useDeleteLibraryEntry } from '../api/library'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import type { FileEntry } from '../types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function FileBrowser({ entryId, folderPath }: { entryId: number; folderPath: string }) {
  const [currentPath, setCurrentPath] = useState('')
  const { data: files, isLoading } = useLibraryFiles(entryId, currentPath)

  if (isLoading) return <LoadingSpinner size={20} />

  return (
    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-2 text-sm">
        <button
          onClick={() => setCurrentPath('')}
          className="text-[var(--accent)] hover:underline"
        >
          {folderPath}
        </button>
        {currentPath && (
          <>
            <span className="text-[var(--text-secondary)]">/</span>
            <span className="text-[var(--text-secondary)]">{currentPath}</span>
          </>
        )}
      </div>
      <div className="divide-y divide-[var(--border)]">
        {files?.map((file: FileEntry) => (
          <div
            key={file.path}
            className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-primary)] transition-colors"
          >
            {file.is_dir ? (
              <button
                onClick={() => setCurrentPath(file.path)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <FolderOpen className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-sm">{file.name}</span>
              </button>
            ) : (
              <>
                <File className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-sm flex-1">{file.name}</span>
                <span className="text-xs text-[var(--text-secondary)]">{formatBytes(file.size)}</span>
                <a
                  href={`/api/library/${entryId}/download?file=${encodeURIComponent(file.path)}`}
                  className="p-1.5 rounded hover:bg-[var(--bg-primary)] text-[var(--accent)]"
                  title="Download"
                  download
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LibraryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const entryId = parseInt(id || '0', 10)
  const { data: entry, isLoading } = useLibraryEntry(entryId)
  const deleteMutation = useDeleteLibraryEntry()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size={40} />
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)]" />
        <h2 className="text-lg font-medium">Entry not found</h2>
        <Link to="/" className="text-[var(--accent)] hover:underline mt-2 inline-block">
          Back to library
        </Link>
      </div>
    )
  }

  const imgSrc = entry.background_image || entry.header_image || entry.capsule_image || ''

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to library
      </Link>

      {/* Hero */}
      <div className="relative rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)]">
        {imgSrc && (
          <div className="h-48 md:h-64 relative">
            <img src={imgSrc} alt={entry.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-card)] via-[var(--bg-card)]/60 to-transparent" />
          </div>
        )}
        <div className={`p-6 ${imgSrc ? '-mt-20 relative' : ''}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">{entry.title || entry.name}</h1>
              <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] flex-wrap">
                <span className="capitalize">{entry.format}</span>
                <span>{formatBytes(entry.folder_size)}</span>
                <span>{entry.file_count} files</span>
                {entry.game_id && (
                  <span className="flex items-center gap-1 text-[var(--green)]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    On FitGirl
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {entry.game_id && (
                <Link
                  to={`/games/${entry.game_id}`}
                  className="px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--border)] transition-colors flex items-center gap-2"
                >
                  <Gamepad2 className="w-4 h-4" />
                  FitGirl Page
                </Link>
              )}
              <button
                onClick={() => {
                  if (confirm('Remove this entry from your library? The files will not be deleted.')) {
                    deleteMutation.mutate(entryId)
                  }
                }}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-[var(--red)]/10 border border-[var(--red)]/20 text-[var(--red)] rounded-lg text-sm font-medium hover:bg-[var(--red)]/20 transition-colors flex items-center gap-2"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {entry.description && (
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
              <h2 className="text-lg font-semibold mb-3">About</h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{entry.description}</p>
            </div>
          )}

          {/* File browser */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Files
            </h2>
            <FileBrowser entryId={entryId} folderPath={entry.folder_path} />
          </div>
        </div>

        {/* Right column: metadata */}
        <div className="space-y-4">
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4 space-y-3">
            <h3 className="font-semibold text-sm">Details</h3>
            <div className="space-y-2 text-sm">
              {entry.steam_app_id && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Steam App ID</span>
                  <span>{entry.steam_app_id}</span>
                </div>
              )}
              {entry.igdb_id && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">IGDB ID</span>
                  <span>{entry.igdb_id}</span>
                </div>
              )}
              {entry.release_date && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Release Date</span>
                  <span>{entry.release_date}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Added</span>
                <span>{new Date(entry.date_added).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Source</span>
                <span className="capitalize">{entry.source}</span>
              </div>
              {entry.download_status !== 'complete' && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Status</span>
                  <span className="capitalize">{entry.download_status}</span>
                </div>
              )}
            </div>
          </div>

          {/* Genres */}
          {(entry.steam_genres?.length > 0 || entry.igdb_genres?.length > 0) && (
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
              <h3 className="font-semibold text-sm mb-2">Genres</h3>
              <div className="flex flex-wrap gap-1.5">
                {[...entry.steam_genres, ...entry.igdb_genres].map(g => (
                  <span
                    key={g.id}
                    className="text-xs px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)]"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
