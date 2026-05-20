interface BadgeProps {
  children: React.ReactNode
  color?: string
}

export default function Badge({ children, color }: BadgeProps) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{
        backgroundColor: color ? `${color}22` : 'var(--accent)',
        color: color || 'var(--accent)',
      }}
    >
      {children}
    </span>
  )
}
