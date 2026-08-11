import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import IconPhotoOff from '@tabler/icons-react/dist/esm/icons/IconPhotoOff.mjs';
import type { Game } from '../api/types';
import { useMarquee } from '../hooks/useMarquee';
import { StatusBadge } from './StatusBadge';

interface GameListRowProps {
  game: Game;
}

export function GameListRow({ game }: GameListRowProps): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const title = game.displayName;
  const [imgError, setImgError] = useState(false);
  const { viewportRef, textRef } = useMarquee(title);

  function onClick() {
    const next = new URLSearchParams(searchParams);
    navigate({ pathname: `/games/${game.id}`, search: next.toString() });
  }

  return (
    <button
      className="game-list-row"
      onClick={onClick}
    >
      {imgError ? (
        <div
          className="game-list-row-thumb"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IconPhotoOff size={16} />
        </div>
      ) : (
        <img
          className="game-list-row-thumb"
          src={`/api/games/${game.id}/artwork/cover`}
          alt={title}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      )}
      <div className="game-list-row-info">
        <div ref={viewportRef} className="game-list-row-title marquee-viewport">
          <span ref={textRef} className="marquee-text">{title}</span>
        </div>
        <div className="game-list-row-meta">
          <StatusBadge status={game.matchStatus} />
          {game.releaseYear && <span>{game.releaseYear}</span>}
        </div>
      </div>
      <span className="game-list-row-size">{formatBytes(game.sizeBytes)}</span>
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}