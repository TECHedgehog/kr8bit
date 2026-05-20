import type { GameListItem } from '../../types'
import GameCard from './GameCard'
import LoadingSpinner from '../ui/LoadingSpinner'

interface GameGridProps {
  games?: GameListItem[]
  isLoading: boolean
}

export default function GameGrid({ games, isLoading }: GameGridProps) {
  if (isLoading) return <LoadingSpinner size={32} />
  if (!games?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
        <p className="text-lg">No games found</p>
        <p className="text-sm mt-1">Try different filters or run a scrape first</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {games.map(game => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  )
}
