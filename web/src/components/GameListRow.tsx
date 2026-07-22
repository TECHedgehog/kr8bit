import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { Game } from '../api/types';
import { StatusBadge } from './StatusBadge';

interface GameListRowProps {
  game: Game;
}

export function GameListRow({ game }: GameListRowProps): JSX.Element {
  const navigate = useNavigate();
  const title = game.title ?? game.entryName;
  const [imgError, setImgError] = useState(false);

  return (
    <button
      className="game-list-row"
      onClick={() => navigate(`/games/${game.id}`)}
    >
      {imgError ? (
        <div
          className="game-list-row-thumb"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ImageOff size={16} />
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
        <div className="game-list-row-title">{title}</div>
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