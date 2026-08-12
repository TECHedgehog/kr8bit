import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import IconPhotoOff from '@tabler/icons-react/dist/esm/icons/IconPhotoOff.mjs';
import type { Game } from '../api/types';
import { useTiltGlow } from '../hooks/useTiltGlow';
import { useMarquee } from '../hooks/useMarquee';

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
  const { viewportRef, textRef } = useMarquee(title);

  function onClick() {
    const next = new URLSearchParams(searchParams);
    navigate({ pathname: `/games/${game.id}`, search: next.toString() });
  }

  return (
    <button ref={cardRef} className="game-card" onClick={onClick}>
      <div className="game-card-tilt tilt-glow">
        <div className="game-card-cover">
          {imgError ? (
            <div className="game-card-placeholder">
              <IconPhotoOff size={32} />
            </div>
          ) : (
            <img
              src={`/api/games/${game.id}/artwork/cover?v=${game.updatedAt}`}
              alt={title}
              loading="lazy"
              onError={() => setImgError(true)}
            />
          )}
        </div>
        <div className="game-card-overlay-shadow" aria-hidden="true" />
      </div>
      <div className="game-card-overlay">
        <div ref={viewportRef} className="game-card-overlay-title marquee-viewport">
          <span ref={textRef} className="marquee-text">{title}</span>
        </div>
      </div>
    </button>
  );
}
