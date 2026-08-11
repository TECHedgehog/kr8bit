import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import IconPhotoOff from '@tabler/icons-react/dist/esm/icons/IconPhotoOff.mjs';
import type { Game } from '../api/types';
import { useTiltGlow } from '../hooks/useTiltGlow';

interface GameCardProps {
  game: Game;
}

export function GameCard({ game }: GameCardProps): JSX.Element {
  const navigate = useNavigate();
  const title = game.displayName;
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  useTiltGlow(cardRef);

  return (
    <button ref={cardRef} className="game-card tilt-glow" onClick={() => navigate(`/games/${game.id}`)}>
      <div className="game-card-cover">
        {imgError ? (
          <div className="game-card-placeholder">
            <IconPhotoOff size={32} />
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
        </div>
      </div>
    </button>
  );
}