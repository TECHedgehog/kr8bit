import { useState } from 'react';
import IconCheck from '@tabler/icons-react/dist/esm/icons/IconCheck.mjs';
import IconCircleCheckFilled from '@tabler/icons-react/dist/esm/icons/IconCircleCheckFilled.mjs';
import IconX from '@tabler/icons-react/dist/esm/icons/IconX.mjs';
import IconCircleXFilled from '@tabler/icons-react/dist/esm/icons/IconCircleXFilled.mjs';
import IconCircleCaretRightFilled from '@tabler/icons-react/dist/esm/icons/IconCircleCaretRightFilled.mjs';
import IconHelpCircleFilled from '@tabler/icons-react/dist/esm/icons/IconHelpCircleFilled.mjs';
import IconAlertTriangle from '@tabler/icons-react/dist/esm/icons/IconAlertTriangle.mjs';

import type { Game, SteamDeckCompatItem } from '../api/types';
import { getDeckTestLabel } from '../data/steamDeckTokens';

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
      'This game is fully compatible with Steam Deck. Default controls, text, and performance meet Valve’s criteria.',
  },
};

function getCategory(steamAppId: number | null, category: number | null | undefined): number {
  if (steamAppId === null) return 0;
  return category ?? 0;
}

function getCheckMeta(displayType: number) {
  if (displayType === 4) {
    return { icon: IconCheck, color: 'var(--success)' };
  }
  if (displayType === 2) {
    return { icon: IconX, color: 'var(--danger)' };
  }
  return { icon: IconAlertTriangle, color: 'var(--warning)' };
}

interface SteamDeckBadgeProps {
  game: Game;
}

export function SteamDeckBadge({ game }: SteamDeckBadgeProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const category = getCategory(game.steamAppId ?? null, game.steamDeckCategory);
  const meta = CATEGORY_META[category] ?? CATEGORY_META[0];
  const items = game.steamDeckItems ?? [];
  const CategoryIcon = meta.icon;

  return (
    <button
      type="button"
      className={`steam-deck-badge ${expanded ? 'is-expanded' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded((v) => !v);
      }}
      aria-label={`Steam Deck compatibility: ${meta.label}`}
      aria-expanded={expanded}
    >
      <span className="steam-deck-badge__head">
        <span className="steam-deck-badge__icon" style={{ color: meta.color }}>
          <CategoryIcon size={20} />
        </span>
        <span className="steam-deck-badge__label" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </span>
      <span className="steam-deck-badge__body-wrap" aria-hidden={!expanded}>
        <span className="steam-deck-badge__body">
          <span className="steam-deck-badge__explanation">{meta.explanation}</span>
          {items.length > 0 && (
            <div className="steam-deck-badge__checks">
              {items.map((item, index) => (
                <DeckCheck key={`${item.locToken}-${index}`} item={item} />
              ))}
            </div>
          )}
        </span>
      </span>
    </button>
  );
}

function DeckCheck({ item }: { item: SteamDeckCompatItem }): JSX.Element {
  const { icon: CheckIcon, color } = getCheckMeta(item.displayType);
  return (
    <div className="steam-deck-badge__check">
      <span className="steam-deck-badge__check-icon" style={{ color }}>
        <CheckIcon size={14} />
      </span>
      <span>{getDeckTestLabel(item.locToken)}</span>
    </div>
  );
}
