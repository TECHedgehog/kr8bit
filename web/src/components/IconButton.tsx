import type { LucideIcon } from 'lucide-react';
import { Tooltip } from './Tooltip';

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
}: IconButtonProps): JSX.Element {
  const resolvedVariant = ghost ? 'ghost' : variant;
  const classes = [
    'icon-button',
    resolvedVariant === 'ghost' ? 'ghost' : '',
    resolvedVariant === 'danger' ? 'danger' : '',
    active ? 'active' : '',
  ].filter(Boolean).join(' ');

  return (
    <Tooltip text={label}>
      <button
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