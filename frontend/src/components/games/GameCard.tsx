import { Link } from 'react-router-dom'
import { Star, Download, Monitor, Gamepad2, CheckCircle2 } from 'lucide-react'
import type { GameListItem } from '../../types'
import Badge from '../ui/Badge'
import SteamDeckBadge from '../ui/SteamDeckBadge'

interface GameCardProps {
  game: GameListItem
}

function getImageSrc(game: GameListItem): string {
  return game.sgdb_grid_url || game.capsule_image || game.header_image || game.image_url
}

function getLogoSrc(game: GameListItem): string {
  return game.sgdb_logo_url || ''
}

export default function GameCard({ game }: GameCardProps) {
  const imgSrc = getImageSrc(game)
  const logoSrc = getLogoSrc(game)
  const hasProgress = game.qbit_torrents?.some(t => t.status === 'downloading' || t.status === 'stalledDL')

  return (
    <Link
      to={`/games/${game.id}`}
      className="block bg-[var(--bg-card)] rounded-lg overflow-hidden border border-[var(--border)] hover:border-[var(--accent)]/40 transition-all hover:shadow-lg hover:shadow-[var(--accent)]/5 group"
    >
      <div className="aspect-[3/4] bg-[var(--bg-secondary)] relative overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={game.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            <Gamepad2 className="w-10 h-10" />
          </div>
        )}
        {logoSrc && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img
              src={logoSrc}
              alt=""
              className="max-w-[60%] max-h-[30%] object-contain drop-shadow-lg"
              aria-hidden="true"
            />
          </div>
        )}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {game.in_library && (
            <div className="bg-[var(--green)]/80 rounded px-1.5 py-0.5 text-[10px] font-bold text-white flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              In Library
            </div>
          )}
          {game.metacritic_score && (
            <div className="bg-[var(--bg-primary)]/80 rounded px-2 py-0.5 text-xs font-bold flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400" />
              {game.metacritic_score}
            </div>
          )}
          {!game.metacritic_score && game.igdb_rating && (
            <div className="bg-[var(--bg-primary)]/80 rounded px-2 py-0.5 text-xs font-bold flex items-center gap-1">
              <Star className="w-3 h-3 text-purple-400" />
              {game.igdb_rating.toFixed(0)}
            </div>
          )}
        </div>
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
          <SteamDeckBadge data={game.protondb_data} size="sm" />
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium leading-tight mb-1 line-clamp-2" title={game.title}>
          {game.title}
        </h3>
        {(game.edition || game.dlc_info) && (
          <div className="text-xs text-[var(--text-secondary)] mb-1 truncate">
            {game.edition && <span className="text-[var(--accent)]">{game.edition}</span>}
            {game.edition && game.dlc_info && <span className="mx-1">·</span>}
            {game.dlc_info && <span>{game.dlc_info}</span>}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-2 flex-wrap">
          {game.platforms_windows && <span title="Windows"><Monitor className="w-3 h-3" /></span>}
          {game.repack_size && <span>{game.repack_size}</span>}
          {hasProgress && (
            <span className="text-xs text-[var(--green)] flex items-center gap-1">
              <Download className="w-3 h-3" /> DL
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {game.tags?.slice(0, 2).map(t => (
            <Badge key={t.id} color="#f887ff">{t.name}</Badge>
          ))}
          {(game.igdb_genres?.length > 0 ? game.igdb_genres : game.steam_genres)?.slice(0, 1).map(g => (
            <Badge key={g.id} color="#339966">{g.name}</Badge>
          ))}
        </div>
      </div>
    </Link>
  )
}