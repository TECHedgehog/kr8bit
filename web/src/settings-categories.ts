export const SETTINGS_CATEGORIES = ['review', 'appearance', 'behavior', 'locations', 'sources', 'maintenance'] as const;

export type SettingsCategory = typeof SETTINGS_CATEGORIES[number];

export function isSettingsCategory(value: string | null | undefined): value is SettingsCategory {
  return typeof value === 'string' && SETTINGS_CATEGORIES.includes(value as SettingsCategory);
}
