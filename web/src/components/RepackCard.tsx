import { memo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import IconPhotoOff from '@tabler/icons-react/dist/esm/icons/IconPhotoOff.mjs';
import type { RepackCatalogGame } from '../api/types';
import { useMarquee } from '../hooks/useMarquee';
import { useTiltGlow } from '../hooks/useTiltGlow';

export const RepackCard = memo(function RepackCard({ game, index }: {
  game: RepackCatalogGame;
  index: number;
}): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [imageFailed, setImageFailed] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  const detailPrefetched = useRef(false);
  const { viewportRef, textRef } = useMarquee(game.title);
  useTiltGlow(cardRef);

  function onPointerEnter() {
    if (detailPrefetched.current) return;
    detailPrefetched.current = true;
    void import('./RepackDetailCard');
  }

  function onClick() {
    const search = new URLSearchParams(searchParams);
    navigate({ pathname: `/repack-catalog/${game.id}`, search: search.toString() });
  }

  return (
    <button
      ref={cardRef}
      className="game-card repack-card"
      data-game-id={game.id}
      style={{ '--card-i': index } as React.CSSProperties}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      type="button"
      aria-label={`Open ${game.title} repack details`}
    >
      <div className="game-card-tilt tilt-glow">
        <div className="game-card-cover">
          {imageFailed ? <div className="game-card-placeholder"><IconPhotoOff size={32} /></div> : (
            <img
              src={`/api/repack-catalog/${game.id}/artwork/cover?v=${encodeURIComponent(game.updatedAt)}`}
              alt={game.title}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          )}
        </div>
        <div className="game-card-overlay-shadow" aria-hidden="true" />
      </div>
      <span className={`repack-card__status repack-card__status--${game.matchStatus.toLowerCase()}`}>{game.matchStatus}</span>
      <span className="repack-card__post-count">{game.posts.length} {game.posts.length === 1 ? 'release' : 'releases'}</span>
      <div className="game-card-overlay">
        <div ref={viewportRef} className="game-card-overlay-title marquee-viewport">
          <span ref={textRef} className="marquee-text">{game.title}</span>
        </div>
      </div>
    </button>
  );
});
