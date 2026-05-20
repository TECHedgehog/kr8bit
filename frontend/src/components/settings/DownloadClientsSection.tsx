import { useState } from 'react'
import {
  useDownloadClients,
  useAddDownloadClient,
  useUpdateDownloadClient,
  useDeleteDownloadClient,
  useTestDownloadClientConnection,
} from '../../api/downloadClients'
import LoadingSpinner from '../ui/LoadingSpinner'
import {
  Server, Save, CheckCircle, XCircle, Plus,
  Trash2, X, Plug, Loader2,
} from 'lucide-react'
import type { DownloadClient, DownloadClientUpdate } from '../../types'

const CLIENT_TYPE_LABELS: Record<string, string> = {
  qbittorrent: 'qBittorrent',
}

interface ModalState {
  open: boolean
  mode: 'add' | 'edit'
  clientId: number | null
}

interface FormData {
  name: string
  client_type: 'qbittorrent'
  host: string
  username: string
  password: string
  is_enabled: boolean
  is_default: boolean
}

function defaultForm(): FormData {
  return {
    name: '',
    client_type: 'qbittorrent',
    host: 'http://localhost:8090',
    username: 'admin',
    password: '',
    is_enabled: true,
    is_default: false,
  }
}

export default function DownloadClientsSection() {
  const { data: clients, isLoading } = useDownloadClients()
  const addMut = useAddDownloadClient()
  const updateMut = useUpdateDownloadClient()
  const deleteMut = useDeleteDownloadClient()
  const testConnectionMut = useTestDownloadClientConnection()

  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add', clientId: null })
  const [form, setForm] = useState<FormData>(defaultForm())
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (isLoading) return <LoadingSpinner size={32} />

  const openAdd = () => {
    setForm(defaultForm())
    setTestResult(null)
    setSaveError(null)
    setModal({ open: true, mode: 'add', clientId: null })
  }

  const openEdit = (client: DownloadClient) => {
    setForm({
      name: client.name,
      client_type: client.client_type as 'qbittorrent',
      host: client.host,
      username: client.username,
      password: '',
      is_enabled: client.is_enabled,
      is_default: client.is_default,
    })
    setTestResult(null)
    setSaveError(null)
    setModal({ open: true, mode: 'edit', clientId: client.id })
  }

  const closeModal = () => {
    setModal({ open: false, mode: 'add', clientId: null })
    setTestResult(null)
    setSaveError(null)
  }

  const handleSave = () => {
    setSaveError(null)
    if (modal.mode === 'edit' && modal.clientId !== null) {
      const payload: DownloadClientUpdate = {}
      if (form.name) payload.name = form.name
      if (form.host) payload.host = form.host
      if (form.username !== undefined) payload.username = form.username
      if (form.password) payload.password = form.password
      payload.is_enabled = form.is_enabled
      payload.is_default = form.is_default
      updateMut.mutate({ id: modal.clientId, data: payload }, {
        onSuccess: closeModal,
        onError: (err: any) => setSaveError(err.response?.data?.detail || err.message || 'Failed to update client'),
      })
    } else {
      addMut.mutate(form, {
        onSuccess: closeModal,
        onError: (err: any) => setSaveError(err.response?.data?.detail || err.message || 'Failed to add client'),
      })
    }
  }

  const handleTest = () => {
    setTestResult(null)
    testConnectionMut.mutate(
      {
        client_type: form.client_type,
        host: form.host,
        username: form.username,
        password: form.password,
      },
      {
        onSuccess: (data: { connected: boolean; error?: string }) => {
          if (data.connected) {
            setTestResult({ success: true, message: 'Connection successful!' })
          } else {
            setTestResult({
              success: false,
              message: data.error || 'Connection failed',
            })
          }
        },
        onError: () => {
          setTestResult({ success: false, message: 'Test request failed' })
        },
      }
    )
  }

  const handleDelete = (clientId: number) => {
    if (confirm('Delete this download client?')) {
      deleteMut.mutate(clientId)
    }
  }

  const modalTitle = modal.mode === 'add' ? 'Add Download Client' : 'Edit Download Client'
  const saveLabel = modal.mode === 'add' ? 'Add Client' : 'Save Changes'
  const isSaving = addMut.isPending || updateMut.isPending

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Server className="w-5 h-5" /> Download Clients
        </h2>
        <button
          onClick={openAdd}
          className="px-3 py-1.5 bg-[var(--accent)] text-black rounded-lg text-sm font-medium hover:opacity-80 transition-opacity flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        Configure one or more download clients. Click a card to edit.
      </p>

      {/* Client Cards */}
      {clients && clients.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {clients.map(client => (
            <div
              key={client.id}
              onClick={() => openEdit(client)}
              className="p-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/40 cursor-pointer transition-all group relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{client.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)]">
                      {CLIENT_TYPE_LABELS[client.client_type] || client.client_type}
                    </span>
                    {client.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {client.host}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      client.is_enabled ? 'bg-[var(--green)]' : 'bg-[var(--red)]'
                    }`}
                    title={client.is_enabled ? 'Enabled' : 'Disabled'}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(client.id)
                    }}
                    className="p-1 rounded hover:bg-[var(--red)]/10 transition-colors text-[var(--text-secondary)] hover:text-[var(--red)] opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(!clients || clients.length === 0) && (
        <div className="text-center py-8 text-[var(--text-secondary)] text-sm border border-dashed border-[var(--border)] rounded-lg">
          No download clients configured yet. Click "Add Client" to get started.
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <h3 className="text-lg font-semibold">{modalTitle}</h3>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-primary)] transition-colors text-[var(--text-secondary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Main qBittorrent"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={form.client_type}
                  onChange={e => setForm(prev => ({ ...prev, client_type: e.target.value as 'qbittorrent' }))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="qbittorrent">qBittorrent</option>
                </select>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Transmission and Deluge support coming soon.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Host</label>
                <input
                  type="text"
                  value={form.host}
                  onChange={e => setForm(prev => ({ ...prev, host: e.target.value }))}
                  placeholder="http://localhost:8090"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="admin"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={modal.mode === 'edit' ? 'Leave blank to keep' : ''}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_enabled}
                    onChange={e => setForm(prev => ({ ...prev, is_enabled: e.target.checked }))}
                    className="rounded border-[var(--border)] w-4 h-4"
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={e => setForm(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="rounded border-[var(--border)] w-4 h-4"
                  />
                  Set as Default
                </label>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleTest}
                  disabled={testConnectionMut.isPending}
                  className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--border)] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {testConnectionMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plug className="w-4 h-4" />
                  )}
                  {testConnectionMut.isPending ? 'Testing...' : 'Test Connection'}
                </button>
                {testResult && (
                  <div
                    className={`mt-2 text-sm flex items-center gap-1.5 px-3 py-2 rounded-lg ${
                      testResult.success
                        ? 'bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/20'
                        : 'bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/20'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0" />
                    )}
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border)]">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--bg-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5 transition-opacity"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {!isSaving && <Save className="w-4 h-4" />}
                {isSaving ? 'Saving...' : saveLabel}
              </button>
            </div>
            {saveError && (
              <div className="mx-5 mb-5 p-3 rounded-lg bg-[var(--red)]/10 border border-[var(--red)]/20 text-[var(--red)] text-sm">
                {saveError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
