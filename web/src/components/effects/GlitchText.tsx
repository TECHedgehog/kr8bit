import { memo, type CSSProperties, type ReactNode } from 'react';

import './GlitchText.css';

// Adapted from react-bits (reactbits.dev) GlitchText — MIT + Commons Clause.
// https://github.com/DavidHDev/react-bits — snapshot of src/content, converted to TS.

export interface GlitchTextProps {
  children: ReactNode;
  speed?: number;
  enableShadows?: boolean;
  enableOnHover?: boolean;
  className?: string;
}

export const GlitchText = memo(function GlitchText({
  children,
  speed = 1,
  enableShadows = true,
  enableOnHover = true,
  className = '',
}: GlitchTextProps): JSX.Element {
  const inlineStyles: Record<string, string> = {
    '--after-duration': `${speed * 3}s`,
    '--before-duration': `${speed * 2}s`,
    '--after-shadow': enableShadows ? '-5px 0 red' : 'none',
    '--before-shadow': enableShadows ? '5px 0 cyan' : 'none',
  };

  const hoverClass = enableOnHover ? 'rb-enable-on-hover' : '';

  return (
    <div
      className={`rb-glitch ${hoverClass} ${className}`}
      style={inlineStyles as CSSProperties}
      data-text={typeof children === 'string' ? children : undefined}
    >
      {children}
    </div>
  );
});
