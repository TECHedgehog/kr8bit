import { useEffect, useState } from 'react';
import IconCircleCheckFilled from '@tabler/icons-react/dist/esm/icons/IconCircleCheckFilled.mjs';
import IconCircleXFilled from '@tabler/icons-react/dist/esm/icons/IconCircleXFilled.mjs';
import IconCircleCaretRightFilled from '@tabler/icons-react/dist/esm/icons/IconCircleCaretRightFilled.mjs';
import IconHelpCircleFilled from '@tabler/icons-react/dist/esm/icons/IconHelpCircleFilled.mjs';

import type { Game } from '../api/types';

type IconComponent = React.ComponentType<{ size?: number | string }>;

interface CategoryMeta {
  label: string;
  icon: IconComponent;
  color: string;
  explanation: string;
}

const CATEGORY_META: Record<number, CategoryMeta> = {
  0: {
    label: 'Unknown',
    icon: IconHelpCircleFilled,
    color: 'var(--text-muted)',
    explanation:
      'This game has not been reviewed for Steam Deck compatibility. Performance and controls are unknown.',
  },
  1: {
    label: 'Unsupported',
    icon: IconCircleXFilled,
    color: 'var(--danger)',
    explanation:
      'This game is currently not functional on Steam Deck. It may use unsupported anti-cheat, a third-party launcher, or be Windows-only.',
  },
  2: {
    label: 'Playable',
    icon: IconCircleCaretRightFilled,
    color: 'var(--warning)',
    explanation:
      'This game runs on Steam Deck but may require manual configuration, use small text, or show non-Deck controller icons.',
  },
  3: {
    label: 'Verified',
    icon: IconCircleCheckFilled,
    color: 'var(--success)',
    explanation:
      'This game is fully compatible with Steam Deck. Default controls, text, and performance meet Valve\u2019s criteria.',
  },
};

function getCategory(steamAppId: number | null, category: number | null | undefined): number {
  if (steamAppId === null) return 0;
  return category ?? 0;
}

interface SteamDeckBadgeProps {
  game: Game;
}

export function SteamDeckBadge({ game }: SteamDeckBadgeProps): JSX.Element {
  const [pinned, setPinned] = useState(false);
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const category = getCategory(game.steamAppId ?? null, game.steamDeckCategory);
  const meta = CATEGORY_META[category] ?? CATEGORY_META[0];
  const CategoryIcon = meta.icon;

  const handleClick = coarse
    ? (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        setPinned((v) => !v);
      }
    : undefined;

  return (
    <div
      role="group"
      tabIndex={0}
      className={`steam-deck-badge${pinned ? ' is-pinned' : ''}`}
      aria-label={`Steam Deck compatibility: ${meta.label}`}
      onClick={handleClick}
    >
      <span className="steam-deck-badge__head">
        <span className="steam-deck-badge__icon" style={{ color: meta.color }}>
          <CategoryIcon size={20} />
        </span>
        <span className="steam-deck-badge__label" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </span>
    </div>
  );
}
