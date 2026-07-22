interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export function Tooltip({ text, children }: TooltipProps): JSX.Element {
  return (
    <span className="tooltip-wrapper">
      {children}
      <span className="tooltip">{text}</span>
    </span>
  );
}