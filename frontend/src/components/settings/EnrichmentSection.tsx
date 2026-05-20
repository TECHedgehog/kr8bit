import { useState } from 'react'
import { useEnrichmentStatus, useRunModule, useStopEnrichment, useEnrichmentConfig } from '../../api/enrichment'
import LoadingSpinner from '../ui/LoadingSpinner'
import { CheckCircle, XCircle, Loader2, Gamepad2, Plug, Image, Info, Play } from 'lucide-react'
import api from '../../api/client'

const MODULES = [
  { key: 'metadata', label: 'Metadata', desc: 'IGDB + Steam (descriptions, genres, ratings, screenshots)', icon: Gamepad2 },
  { key: 'assets', label: 'Assets', desc: 'SteamGridDB (grids, heroes, logos, icons)', icon: Image },
  { key: 'info', label: 'Additional Info', desc: 'ProtonDB + HLTB (compatibility, completion times)', icon: Info },
]

export default function EnrichmentSection() {
  const { data: enrichment, isLoading: enrichLoading } = useEnrichmentStatus()
  const { data: enrichConfig } = useEnrichmentConfig()
  const runModuleMut = useRunModule()
  const stopMut = useStopEnrichment()
  const [runningModules, setRunningModules] = useState<string[]>([])

  const [igdbTestResult, setIgdbTestResult] = useState<{ connected: boolean; error?: string } | null>(null)
  const [igdbTesting, setIgdbTesting] = useState(false)

  const isAnyRunning = enrichment?.is_running || false

  const handleRunModule = (moduleKey: string) => {
    setRunningModules(prev => [...prev, moduleKey])
    runModuleMut.mutate(moduleKey, {
      onSettled: () => {
        setRunningModules(prev => prev.filter(k => k !== moduleKey))
      },
    })
  }

  const counts = enrichment?.metadata

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Enrichment</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Run enrichment modules independently to fetch game metadata, assets, and additional info.
        </p>
      </div>

      {enrichLoading ? <LoadingSpinner /> : (
        <div className="space-y-4">
          {isAnyRunning && (
            <div className="flex items-center gap-2 text-sm text-yellow-400 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              Enrichment running...
              <button onClick={() => stopMut.mutate()} className="ml-2 text-xs underline hover:no-underline">
                Stop All
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Total Games</div>
              <div className="text-xl font-bold">{enrichment?.total_games ?? 0}</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Pending</div>
              <div className="text-xl font-bold text-yellow-400">{counts?.pending ?? 0}</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Failed</div>
              <div className="text-xl font-bold text-red-400">
                {(counts?.igdb?.failed ?? 0) + (counts?.steamgrid?.failed ?? 0) + (counts?.protondb?.failed ?? 0) + (counts?.hltb?.failed ?? 0)}
              </div>
            </div>
          </div>

          {/* Module Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {MODULES.map(mod => {
              const Icon = mod.icon
              const modRunning = enrichment?.modules?.[mod.key] || runningModules.includes(mod.key)
              const matchedCount = mod.key === 'metadata'
                ? (counts?.igdb?.matched ?? 0) + (counts?.steam?.matched ?? 0)
                : mod.key === 'assets'
                ? counts?.steamgrid?.matched ?? 0
                : (counts?.protondb?.matched ?? 0) + (counts?.hltb?.matched ?? 0)
              const failedCount = mod.key === 'metadata'
                ? (counts?.igdb?.failed ?? 0) + (counts?.steam?.failed ?? 0)
                : mod.key === 'assets'
                ? counts?.steamgrid?.failed ?? 0
                : (counts?.protondb?.failed ?? 0) + (counts?.hltb?.failed ?? 0)

              return (
                <div key={mod.key} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-[var(--accent)]" />
                    <h3 className="font-medium text-sm">{mod.label}</h3>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mb-3">{mod.desc}</p>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mb-3">
                    <span className="text-green-400">Matched: {matchedCount}</span>
                    {failedCount > 0 && <span className="text-red-400">Failed: {failedCount}</span>}
                  </div>
                  <button
                    onClick={() => handleRunModule(mod.key)}
                    disabled={modRunning || isAnyRunning}
                    className="w-full px-3 py-1.5 text-xs rounded bg-[var(--accent)] text-black font-medium hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {modRunning ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Running...</>
                    ) : (
                      <><Play className="w-3 h-3" /> Run {mod.label}</>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Run All */}
          <button
            onClick={() => handleRunModule('all')}
            disabled={isAnyRunning}
            className="px-6 py-2 bg-[var(--accent)] text-black rounded-lg font-medium text-sm hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
          >
            {isAnyRunning ? 'Running...' : 'Run All Enrichment'}
          </button>
        </div>
      )}

      {/* Configuration Status */}
      <div className="border-t border-[var(--border)] pt-8 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Gamepad2 className="w-5 h-5" /> IGDB / Twitch
          </h3>
          <div className="flex items-center gap-2 text-sm">
            {enrichConfig?.igdb_configured ? (
              <span className="flex items-center gap-1 text-[var(--green)]"><CheckCircle className="w-4 h-4" /> Configured</span>
            ) : (
              <span className="flex items-center gap-1 text-yellow-400"><XCircle className="w-4 h-4" /> Not configured</span>
            )}
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          IGDB is the primary metadata provider. Configure via <code className="text-xs bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border)]">TWITCH_CLIENT_ID</code> / <code className="text-xs bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border)]">TWITCH_CLIENT_SECRET</code>.
        </p>

        <div className="border-t border-[var(--border)] pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Image className="w-5 h-5" /> SteamGridDB
            </h3>
            <div className="flex items-center gap-2 text-sm">
              {enrichConfig?.steamgrid_configured ? (
                <span className="flex items-center gap-1 text-[var(--green)]"><CheckCircle className="w-4 h-4" /> API Key Set</span>
              ) : (
                <span className="flex items-center gap-1 text-yellow-400"><XCircle className="w-4 h-4" /> No API Key</span>
              )}
            </div>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            SteamGridDB provides high-quality game artwork (grids, heroes, logos, icons). Get an API key at{' '}
            <a href="https://www.steamgriddb.com/profile/api" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
              steamgriddb.com
            </a>
            . Configure via <code className="text-xs bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border)]">STEAMGRIDDB_API_KEY</code>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setIgdbTesting(true)
              setIgdbTestResult(null)
              try {
                const res = await api.post('/settings/igdb-test')
                setIgdbTestResult(res.data)
              } catch {
                setIgdbTestResult({ connected: false, error: 'Request failed' })
              } finally {
                setIgdbTesting(false)
              }
            }}
            disabled={igdbTesting}
            className="px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--border)] disabled:opacity-50 flex items-center gap-2"
          >
            {igdbTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
            {igdbTesting ? 'Testing...' : 'Test IGDB Connection'}
          </button>
          {igdbTestResult && (
            <p className={`text-sm ${igdbTestResult.connected ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
              {igdbTestResult.connected ? 'Connection successful!' : `Connection failed. ${igdbTestResult.error || ''}`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}