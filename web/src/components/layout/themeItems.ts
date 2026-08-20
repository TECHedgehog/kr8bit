// Shared theme-toggle data for the TopBar lens. Single source of truth for the
// two theme entries, their icons, and the accent color shown through the glass
// lens on the active entry.
import type { ComponentType } from 'react';
import type { IconProps } from '@tabler/icons-react';
import IconMoon from '@tabler/icons-react/dist/esm/icons/IconMoon.mjs';
import IconSun from '@tabler/icons-react/dist/esm/icons/IconSun.mjs';

export type TablerIcon = ComponentType<IconProps>;

export interface ThemeItem {
  theme: 'dark' | 'light';
  icon: TablerIcon;
  /** Accent color shown through the glass lens on the active entry. */
  color: string;
}

export const THEME_ITEMS: ThemeItem[] = [
  { theme: 'dark', icon: IconMoon, color: '#6366f1' },
  { theme: 'light', icon: IconSun, color: '#f59e0b' },
];
