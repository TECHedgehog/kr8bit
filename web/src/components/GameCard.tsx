import { memo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import IconPhotoOff from '@tabler/icons-react/dist/esm/icons/IconPhotoOff.mjs';
import type { Game } from '../api/types';
import { useTiltGlow } from '../hooks/useTiltGlow';
import { useMarquee } from '../hooks/useMarquee';

interface GameCardProps {
  game: Game;
  /** Column position within the grid row — drives the reveal stagger. */
  index: number;
}

export const GameCard = memo(function GameCard({ game, index }: GameCardProps): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const title = game.displayName;
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  const detailChunkPrefetched = useRef(false);
  useTiltGlow(cardRef);
  const { viewportRef, textRef } = useMarquee(title);

  // Warm the detail-dialog chunk (vidstack + hls.js) on hover so the first
  // open doesn't pay the network + parse cost. Same module as the lazy route
  // in App.tsx — bundler dedupes to one chunk.
  function onPointerEnter() {
    if (detailChunkPrefetched.current) return;
    detailChunkPrefetched.current = true;
    void import('./GameDetailCard');
  }

  function onClick() {
    const next = new URLSearchParams(searchParams);
    navigate({ pathname: `/games/${game.id}`, search: next.toString() });
  }

  return (
    <button
      ref={cardRef}
      className="game-card"
      // useGridFlip matches cards across panel-toggle re-slices by id.
      data-game-id={game.id}
      // Column position for the reveal stagger delay (.game-grid-row.is-visible).
      style={{ '--card-i': index } as React.CSSProperties}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
    >
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
              decoding="async"
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
});
