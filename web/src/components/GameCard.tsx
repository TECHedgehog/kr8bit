import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { Game } from '../api/types';
import { StatusBadge } from './StatusBadge';
import { useTiltGlow } from '../hooks/useTiltGlow';

interface GameCardProps {
  game: Game;
}

function formatScore(score: number | null): string {
  if (score === null) return '';
  return `${Math.round(score)}%`;
}

export function GameCard({ game }: GameCardProps): JSX.Element {
  const navigate = useNavigate();
  const title = game.title ?? game.entryName;
  const score = formatScore(game.matchScore);
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  useTiltGlow(cardRef);

  return (
    <button ref={cardRef} className="game-card tilt-glow" onClick={() => navigate(`/games/${game.id}`)}>
      <div className="game-card-cover">
        {imgError ? (
          <div className="game-card-placeholder">
            <ImageOff size={32} />
          </div>
        ) : (
          <img
            src={`/api/games/${game.id}/artwork/cover`}
            alt={title}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}
        <div className="game-card-overlay">
          <div className="game-card-overlay-title">{title}</div>
          <div className="game-card-overlay-meta">
            <StatusBadge status={game.matchStatus} />
            {score && <span className="game-card-score">{score}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}