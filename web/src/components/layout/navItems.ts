// Shared nav data for the TopBar. Single source of truth for nav items,
// icons, and labels.
import type { ComponentType } from 'react';
import type { IconProps } from '@tabler/icons-react';
import IconLibrary from '@tabler/icons-react/dist/esm/icons/IconLibrary.mjs';
import IconSettings from '@tabler/icons-react/dist/esm/icons/IconSettings.mjs';
import IconWorld from '@tabler/icons-react/dist/esm/icons/IconWorld.mjs';

export type TablerIcon = ComponentType<IconProps>;

export interface NavItem {
  to: string;
  label: string;
  icon: TablerIcon;
  /** Per-page accent color shown through the glass lens on the active item. */
  color: string;
  requiresRepackSource?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/games', label: 'Library', icon: IconLibrary, color: '#10b981' },
  { to: '/repack-catalog', label: 'Repacks', icon: IconWorld, color: '#f97316', requiresRepackSource: true },
  { to: '/settings', label: 'Settings', icon: IconSettings, color: '#8b5cf6' },
];
