import type { Game } from '../api/types';
import { StatusBadge } from './StatusBadge';

interface GameCardProps {
  game: Game;
  onOpen: (id: string) => void;
}

function formatScore(score: number | null): string {
  if (score === null) return '';
  return `${Math.round(score)}%`;
}

export function GameCard({ game, onOpen }: GameCardProps) {
  const title = game.title ?? game.entryName;
  const score = formatScore(game.matchScore);
  return (
    <button className="game-card" onClick={() => onOpen(game.id)}>
      <div className="game-card-cover">
        <img
          src={`/api/games/${game.id}/artwork/cover`}
          alt={title}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
          }}
        />
      </div>
      <div className="game-card-body">
        <div className="game-card-title" title={title}>{title}</div>
        <div className="game-card-meta">
          <StatusBadge status={game.matchStatus} />
          {score && <span className="game-card-score">{score}</span>}
        </div>
      </div>
    </button>
  );
}