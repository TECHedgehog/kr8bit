import { memo, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

import './StarBorder.css';

// Adapted from react-bits (reactbits.dev) StarBorder — MIT + Commons Clause.
// https://github.com/DavidHDev/react-bits — snapshot of src/content, converted to TS.
// Note: upstream spread `{...rest}` after `style`, which clobbered the padding
// style — fixed here by spreading rest first.

export interface StarBorderProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  color?: string;
  speed?: string;
  thickness?: number;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  children?: ReactNode;
}

export const StarBorder = memo(function StarBorder({
  as: Component = 'button',
  className = '',
  color = 'white',
  speed = '6s',
  thickness = 1,
  backgroundColor = '#000000',
  textColor = '#ffffff',
  borderColor = '#222222',
  children,
  ...rest
}: StarBorderProps): JSX.Element {
  return (
    <Component
      className={`rb-star-border ${className}`}
      {...rest}
      style={{ padding: `${thickness}px 0`, ...rest.style }}
    >
      <div
        className="rb-border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      ></div>
      <div
        className="rb-border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      ></div>
      <div className="rb-inner-content" style={{ background: backgroundColor, color: textColor, borderColor }}>
        {children}
      </div>
    </Component>
  );
});
