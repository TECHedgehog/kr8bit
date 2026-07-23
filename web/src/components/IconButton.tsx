import { useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { useTiltGlow } from '../hooks/useTiltGlow';

type Variant = 'default' | 'ghost' | 'danger';

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: Variant;
  ghost?: boolean;
  type?: 'button' | 'submit';
  size?: number;
  tiltGlow?: boolean;
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
  tiltGlow = false,
}: IconButtonProps): JSX.Element {
  const btnRef = useRef<HTMLButtonElement>(null);
  if (tiltGlow) useTiltGlow(btnRef);

  const resolvedVariant = ghost ? 'ghost' : variant;
  const classes = [
    'icon-button',
    resolvedVariant === 'ghost' ? 'ghost' : '',
    resolvedVariant === 'danger' ? 'danger' : '',
    active ? 'active' : '',
    tiltGlow ? 'tilt-glow' : '',
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