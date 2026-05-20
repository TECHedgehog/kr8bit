import { CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import type { ProtonDBData } from '../../types'

const TIER_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
  verified: {
    label: 'Verified',
    icon: <CheckCircle className="w-4 h-4" />,
    bg: 'bg-green-600/20',
    text: 'text-green-400',
    border: 'border-green-600/30',
  },
  playable: {
    label: 'Playable',
    icon: <AlertTriangle className="w-4 h-4" />,
    bg: 'bg-yellow-600/20',
    text: 'text-yellow-400',
    border: 'border-yellow-600/30',
  },
  unsupported: {
    label: 'Unsupported',
    icon: <XCircle className="w-4 h-4" />,
    bg: 'bg-red-600/20',
    text: 'text-red-400',
    border: 'border-red-600/30',
  },
  unknown: {
    label: 'Unknown',
    icon: <HelpCircle className="w-4 h-4" />,
    bg: 'bg-gray-600/20',
    text: 'text-gray-400',
    border: 'border-gray-600/30',
  },
}

interface SteamDeckBadgeProps {
  data: ProtonDBData | null
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export default function SteamDeckBadge({ data, showLabel = true, size = 'md' }: SteamDeckBadgeProps) {
  if (!data) return null

  const config = TIER_CONFIG[data.deck_tier] || TIER_CONFIG.unknown
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-0.5' : 'text-xs px-2 py-1 gap-1'

  return (
    <span
      className={`inline-flex items-center rounded font-semibold border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
      title={`Steam Deck ${config.label}`}
    >
      {config.icon}
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}
