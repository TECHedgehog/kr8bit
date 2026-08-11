import { useRef } from 'react';
import type { ComponentType } from 'react';
import type { IconProps } from '@tabler/icons-react';
import { Tooltip } from './Tooltip';
import { useGlowFollow } from '../hooks/useGlowFollow';

type Variant = 'default' | 'ghost' | 'danger';

type TablerIcon = ComponentType<IconProps>;

interface IconButtonProps {
  icon: TablerIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: Variant;
  ghost?: boolean;
  type?: 'button' | 'submit';
  size?: number;
  glow?: boolean;
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  variant = 'default',
  ghost = false,
  type = 'button',
  size = 18,
  glow = false,
}: IconButtonProps): JSX.Element {
  const btnRef = useRef<HTMLButtonElement>(null);
  useGlowFollow(btnRef, glow);

  const resolvedVariant = ghost ? 'ghost' : variant;
  const classes = [
    'icon-button',
    resolvedVariant === 'ghost' ? 'ghost' : '',
    resolvedVariant === 'danger' ? 'danger' : '',
    active ? 'active' : '',
    glow ? 'glow-follow' : '',
  ].filter(Boolean).join(' ');

  return (
    <Tooltip text={label}>
      <button
        ref={btnRef}
        className={classes}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        type={type}
      >
        <Icon size={size} />
      </button>
    </Tooltip>
  );
}