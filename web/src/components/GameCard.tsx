import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import IconPhotoOff from '@tabler/icons-react/dist/esm/icons/IconPhotoOff.mjs';
import type { Game } from '../api/types';
import { useTiltGlow } from '../hooks/useTiltGlow';

interface GameCardProps {
  game: Game;
}

export function GameCard({ game }: GameCardProps): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const title = game.displayName;
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  useTiltGlow(cardRef);

  function onClick() {
    const next = new URLSearchParams(searchParams);
    navigate({ pathname: `/games/${game.id}`, search: next.toString() });
  }

  return (
    <button ref={cardRef} className="game-card tilt-glow" onClick={onClick}>
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