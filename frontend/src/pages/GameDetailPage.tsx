import { useParams, Link } from 'react-router-dom'
import { useGame } from '../api/games'
import { useRunSingleEnrichment } from '../api/enrichment'
import { useSmartAddFromCatalog } from '../api/library'
import AddMagnetButton from '../components/qbittorrent/AddMagnetButton'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Badge from '../components/ui/Badge'
import SteamDeckBadge from '../components/ui/SteamDeckBadge'
import ProtonDBCard from '../components/ui/ProtonDBCard'
import HowLongToBeatCard from '../components/ui/HowLongToBeatCard'
import MediaGallery from '../components/ui/MediaGallery'
import {
  ArrowLeft, Star, Globe, Monitor, ExternalLink,
  Magnet, FileDown, Calendar, CheckCircle2, Library, Loader2,
} from 'lucide-react'
import { useState } from 'react'

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>()
  const gameId = parseInt(id || '0', 10)
  const { data: game, isLoading } = useGame(gameId)
  const enrichMut = useRunSingleEnrichment()
  const smartAddMut = useSmartAddFromCatalog()
  const [showMirrors, setShowMirrors] = useState(false)

  if (isLoading) return <LoadingSpinner size={32} />
  if (!game) {
    return (
      <div className="text-center py-20 text-[var(--text-secondary)]">
        Game not found
      </div>
    )
  }

  const headerImg = game.sgdb_hero_url || game.background_image || game.header_image || game.image_url
  const displayTitle = game.title
  const showOriginalTitle = game.title_original && game.title_original !== game.title

  const igdbStatus = game.enrichment?.igdb || game.igdb_status || 'none'
  const steamgridStatus = game.enrichment?.steamgrid || game.steamgrid_status || 'none'
  const protondbStatus = game.enrichment?.protondb || game.protondb_status || 'none'
  const hltbStatus = game.enrichment?.hltb || game.hltb_status || 'none'
  const hasAnyMetadata = igdbStatus === 'matched' || game.igdb_id
  const hasAllAssets = steamgridStatus === 'matched'

  const allGenres = [
    ...(game.igdb_genres || []).map(g => ({ ...g, source: 'IGDB' })),
    ...(game.steam_genres || []).map(g => ({ ...g, source: 'Steam' })),
  ]

  const hasTorrents = (game.magnet_links && game.magnet_links.length > 0) || (game.torrent_files && game.torrent_files.length > 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link to="/games" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Games
      </Link>

      {/* Hero */}
      <div className="relative rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border)]">
        {headerImg && (
          <div className="absolute inset-0">
            <img src={headerImg} alt="" className="w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-card)] via-[var(--bg-card)]/60 to-transparent" />
          </div>
        )}
        <div className="relative p-6 flex flex-col sm:flex-row gap-6">
          {game.capsule_image && (
            <img src={game.capsule_image} alt={displayTitle} className="w-40 h-[60px] object-cover rounded shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold mb-1">{displayTitle}</h1>
            {showOriginalTitle && (
              <p className="text-xs text-[var(--text-secondary)] mb-2">Originally: {game.title_original}</p>
            )}
            {game.repack_version && (
              <p className="text-sm text-[var(--text-secondary)] mb-1">Repack Version: {game.repack_version}</p>
            )}
            {(game.edition || game.dlc_info) && (
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                {game.edition && <span className="text-[var(--accent)]">{game.edition}</span>}
                {game.edition && game.dlc_info && <span className="mx-1">·</span>}
                {game.dlc_info && <span>{game.dlc_info}</span>}
              </p>
            )}
            {/* Library status */}
            {game.in_library ? (
              <div className="flex items-center gap-2 mt-3">
                <div className="bg-[var(--green)]/10 border border-[var(--green)]/20 text-[var(--green)] rounded-lg px-3 py-1.5 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  In Your Library
                </div>
                {game.library_entry_id && (
                  <Link
                    to={`/library/${game.library_entry_id}`}
                    className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    <Library className="w-3.5 h-3.5" />
                    View in Library
                  </Link>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <button
                  onClick={() => smartAddMut.mutate({ game_id: game.id })}
                  disabled={smartAddMut.isPending}
                  className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
                >
                  {smartAddMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Library className="w-4 h-4" />
                  )}
                  {smartAddMut.isPending ? 'Adding...' : 'Add to Library'}
                </button>
                {smartAddMut.isSuccess && (
                  <p className="text-sm text-[var(--green)] mt-1">{smartAddMut.data?.message}</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap text-sm mt-3">
              {game.metacritic_score && (
                <span className="flex items-center gap-1 bg-[var(--bg-primary)]/80 rounded px-2 py-0.5">
                  <Star className="w-4 h-4 text-yellow-400" /> {game.metacritic_score}
                </span>
              )}
              {game.igdb_rating && (
                <span className="flex items-center gap-1 bg-[var(--bg-primary)]/80 rounded px-2 py-0.5">
                  <Star className="w-4 h-4 text-purple-400" /> {game.igdb_rating.toFixed(0)}/100
                </span>
              )}
              <SteamDeckBadge data={game.protondb_data} />
              {game.platforms_windows && <span title="Windows"><Monitor className="w-4 h-4" /></span>}
              {game.website && (
                <a href={game.website} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Website
                </a>
              )}
              {game.steam_app_id && (
                <a href={`https://store.steampowered.com/app/${game.steam_app_id}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Steam
                </a>
              )}
              {game.igdb_id && (
                <a href={`https://www.igdb.com/games/${game.slug}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> IGDB
                </a>
              )}
              {game.release_date_steam && (
                <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                  <Calendar className="w-3 h-3" /> {game.release_date_steam}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {game.description && (
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">About</h2>
              <p className="text-sm leading-relaxed">{game.description}</p>
            </div>
          )}

          {/* Media Gallery */}
          {(game.screenshots?.length || game.videos?.length) ? (
            <MediaGallery screenshots={game.screenshots || []} videos={game.videos || []} />
          ) : null}

          {/* Torrent & Magnet Links */}
          {hasTorrents && (
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Torrent Links</h2>
              <div className="space-y-3">
                {game.magnet_links?.map(m => (
                  <div key={m.id} className="flex items-center gap-2 flex-wrap">
                    <a href={m.magnet_uri} className="text-[var(--accent)] hover:underline text-sm break-all flex-1">
                      <Magnet className="w-4 h-4 inline mr-1" />
                      Magnet Link
                    </a>
                    <AddMagnetButton magnetUri={m.magnet_uri} />
                    <button
                      onClick={() => navigator.clipboard.writeText(m.magnet_uri)}
                      className="px-2 py-1 text-xs rounded bg-[var(--bg-primary)] border border-[var(--border)] hover:bg-[var(--border)] transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
                {game.torrent_files?.map(t => (
                  <div key={t.id} className="flex items-center gap-2">
                    <a href={t.torrent_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline text-sm flex items-center gap-1">
                      <FileDown className="w-4 h-4" /> {t.source}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mirrors */}
          {game.download_mirrors && game.download_mirrors.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
              <button onClick={() => setShowMirrors(!showMirrors)} className="flex items-center justify-between w-full">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Direct Download Mirrors ({game.download_mirrors.length})</h2>
                {showMirrors ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                )}
              </button>
              {showMirrors && (
                <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
                  {game.download_mirrors.map(m => (
                    <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-[var(--accent)] hover:underline truncate">
                      <FileDown className="w-3 h-3 inline mr-1" />
                      {m.filename || m.mirror_type}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          {/* Game Info */}
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Game Info</h3>
            <dl className="space-y-2 text-sm">
              {game.companies && (
                <div><dt className="text-[var(--text-secondary)] text-xs">Companies</dt><dd>{game.companies}</dd></div>
              )}
              {game.languages && (
                <div><dt className="text-[var(--text-secondary)] text-xs">Languages</dt><dd>{game.languages}</dd></div>
              )}
              {game.original_size && (
                <div><dt className="text-[var(--text-secondary)] text-xs">Original Size</dt><dd>{game.original_size}</dd></div>
              )}
              {game.repack_size && (
                <div><dt className="text-[var(--text-secondary)] text-xs">Repack Size</dt><dd>{game.repack_size}</dd></div>
              )}
              {game.selective_download && (
                <div><dt className="text-[var(--text-secondary)] text-xs">Selective DL</dt><dd>{game.selective_download}</dd></div>
              )}
              {game.date_published && (
                <div><dt className="text-[var(--text-secondary)] text-xs">Published</dt><dd>{new Date(game.date_published).toLocaleDateString()}</dd></div>
              )}
            </dl>
          </div>

          {/* ProtonDB */}
          <ProtonDBCard data={game.protondb_data} />

          {/* Tags */}
          {game.tags && game.tags.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {game.tags.map(t => (
                  <Link key={t.id} to={`/games?tag=${t.id}`}>
                    <Badge color="#f887ff">{t.name}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Categories & Genres */}
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
            {game.categories && game.categories.length > 0 && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">Categories</h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {game.categories.map(cat => <Badge key={cat.id}>{cat.name}</Badge>)}
                </div>
              </>
            )}
            {allGenres.length > 0 && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">Genres</h3>
                <div className="flex flex-wrap gap-1.5">
                  {allGenres.map((g, i) => <Badge key={`${g.id}-${i}`} color="#339966">{g.name}</Badge>)}
                </div>
              </>
            )}
          </div>

          {/* How Long To Beat */}
          <HowLongToBeatCard data={game.hltb_data} />

          {/* System Requirements */}
          {game.system_requirements && game.system_requirements.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">System Requirements</h3>
              {['minimum', 'recommended'].map(type => {
                const req = game.system_requirements!.find(r => r.req_type === type)
                if (!req) return null
                return (
                  <div key={type} className="mb-3 last:mb-0">
                    <h4 className="text-sm font-medium capitalize mb-1">{type}</h4>
                    <dl className="space-y-1 text-xs">
                      {req.os && <div><span className="text-[var(--text-secondary)]">OS: </span>{req.os}</div>}
                      {req.processor && <div><span className="text-[var(--text-secondary)]">CPU: </span>{req.processor}</div>}
                      {req.memory && <div><span className="text-[var(--text-secondary)]">RAM: </span>{req.memory}</div>}
                      {req.graphics && <div><span className="text-[var(--text-secondary)]">GPU: </span>{req.graphics}</div>}
                      {req.directx && <div><span className="text-[var(--text-secondary)]">DirectX: </span>{req.directx}</div>}
                      {req.storage && <div><span className="text-[var(--text-secondary)]">Storage: </span>{req.storage}</div>}
                    </dl>
                  </div>
                )
              })}
            </div>
          )}

          {/* Enrichment Modules */}
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Enrichment</h3>
            <div className="space-y-2 text-sm">
              {/* Metadata Module */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${igdbStatus === 'matched' ? 'bg-green-400' : igdbStatus === 'failed' ? 'bg-red-400' : 'bg-gray-500'}`} />
                  <span className="text-[var(--text-secondary)]">Metadata</span>
                </div>
                {!hasAnyMetadata && (
                  <button
                    onClick={() => enrichMut.mutate({ gameId: game.id, modules: ['metadata'] })}
                    disabled={enrichMut.isPending}
                    className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-black font-medium hover:opacity-80 disabled:opacity-50"
                  >
                    {enrichMut.isPending ? '...' : 'Run'}
                  </button>
                )}
              </div>
              {/* Assets Module */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${steamgridStatus === 'matched' ? 'bg-green-400' : steamgridStatus === 'failed' ? 'bg-red-400' : 'bg-gray-500'}`} />
                  <span className="text-[var(--text-secondary)]">Assets</span>
                </div>
                {!hasAllAssets && game.igdb_id && (
                  <button
                    onClick={() => enrichMut.mutate({ gameId: game.id, modules: ['assets'] })}
                    disabled={enrichMut.isPending}
                    className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-black font-medium hover:opacity-80 disabled:opacity-50"
                  >
                    {enrichMut.isPending ? '...' : 'Run'}
                  </button>
                )}
              </div>
              {/* Info Module */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${protondbStatus === 'matched' && hltbStatus === 'matched' ? 'bg-green-400' : protondbStatus === 'failed' || hltbStatus === 'failed' ? 'bg-red-400' : 'bg-gray-500'}`} />
                  <span className="text-[var(--text-secondary)]">Additional Info</span>
                </div>
                {game.steam_app_id && !(protondbStatus === 'matched' && hltbStatus === 'matched') && (
                  <button
                    onClick={() => enrichMut.mutate({ gameId: game.id, modules: ['info'] })}
                    disabled={enrichMut.isPending}
                    className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-black font-medium hover:opacity-80 disabled:opacity-50"
                  >
                    {enrichMut.isPending ? '...' : 'Run'}
                  </button>
                )}
              </div>
              {/* Run All button */}
              {!hasAnyMetadata && (
                <button
                  onClick={() => enrichMut.mutate({ gameId: game.id })}
                  disabled={enrichMut.isPending}
                  className="mt-2 w-full px-3 py-1.5 text-xs rounded bg-[var(--accent)] text-black font-medium hover:opacity-80 disabled:opacity-50"
                >
                  {enrichMut.isPending ? 'Enriching...' : 'Run All Enrichment'}
                </button>
              )}
            </div>
          </div>

          {/* Download Client Progress */}
          {game.qbit_torrents && game.qbit_torrents.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Downloads</h3>
              {/* Group by client_id */}
              {(() => {
                const byClient: Record<number, typeof game.qbit_torrents> = {}
                game.qbit_torrents.forEach(qt => {
                  const cid = qt.client_id ?? 0
                  if (!byClient[cid]) byClient[cid] = []
                  byClient[cid].push(qt)
                })
                return Object.entries(byClient).map(([cid, torrents]) => (
                  <div key={cid} className="mb-3 last:mb-0">
                    {Object.keys(byClient).length > 1 && (
                      <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Client #{cid}
                      </p>
                    )}
                    {torrents.map(qt => (
                      <div key={qt.info_hash} className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--text-secondary)] text-xs">{qt.status}</span>
                          <span className="text-xs">{qt.progress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--accent)] rounded-full transition-all"
                            style={{ width: `${qt.progress}%` }}
                          />
                        </div>
                        {qt.dlspeed > 0 && (
                          <p className="text-xs text-[var(--text-secondary)]">
                            DL: {(qt.dlspeed / 1024 / 1024).toFixed(1)} MB/s
                            {qt.eta > 0 && ` | ETA: ${Math.ceil(qt.eta / 60)}m`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
