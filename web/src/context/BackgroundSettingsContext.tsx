import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useTheme, type Theme } from './ThemeContext';

export type BackgroundTint = 'indigo' | 'violet' | 'teal' | 'rose' | 'amber';
export type BackgroundShade = 'dark-black' | 'dark-charcoal' | 'dark-slate' | 'dark-grey' | 'dark-silver' | 'light-white' | 'light-ivory' | 'light-linen' | 'light-sand' | 'light-sepia';

interface ShadeOption {
  id: BackgroundShade;
  label: string;
  color: string;
}

interface TintPalette {
  label: string;
  dark: string;
  light: string;
}

export const BACKGROUND_DARK_SHADES: ShadeOption[] = [
  { id: 'dark-black', label: 'Black', color: '#050608' },
  { id: 'dark-charcoal', label: 'Charcoal', color: '#0b0d10' },
  { id: 'dark-slate', label: 'Slate', color: '#14171c' },
  { id: 'dark-grey', label: 'Grey', color: '#20242b' },
  { id: 'dark-silver', label: 'Silver', color: '#303640' },
];

export const BACKGROUND_LIGHT_SHADES: ShadeOption[] = [
  { id: 'light-white', label: 'White', color: '#ffffff' },
  { id: 'light-ivory', label: 'Ivory', color: '#faf9f6' },
  { id: 'light-linen', label: 'Linen', color: '#f3efe6' },
  { id: 'light-sand', label: 'Sand', color: '#e8dfd0' },
  { id: 'light-sepia', label: 'Sepia', color: '#d8cbb8' },
];

export const BACKGROUND_TINTS: Record<BackgroundTint, TintPalette> = {
  indigo: { label: 'Indigo', dark: '#8b8fff', light: '#4f46e5' },
  violet: { label: 'Violet', dark: '#c084fc', light: '#9333ea' },
  teal: { label: 'Teal', dark: '#2dd4bf', light: '#0f766e' },
  rose: { label: 'Rose', dark: '#fb7185', light: '#be123c' },
  amber: { label: 'Amber', dark: '#fbbf24', light: '#b45309' },
};

export function getBackgroundShadeColor(shade: BackgroundShade): string {
  const option = [...BACKGROUND_DARK_SHADES, ...BACKGROUND_LIGHT_SHADES].find((entry) => entry.id === shade);
  return option?.color ?? BACKGROUND_DARK_SHADES[0].color;
}

export function getEffectTint(theme: Theme, tint: BackgroundTint): string {
  return BACKGROUND_TINTS[tint][theme];
}

interface BackgroundSettingsContextValue {
  tint: BackgroundTint;
  darkShade: BackgroundShade;
  lightShade: BackgroundShade;
  setTint: (tint: BackgroundTint) => void;
  setDarkShade: (shade: BackgroundShade) => void;
  setLightShade: (shade: BackgroundShade) => void;
}

const STORAGE_KEY = 'kr8bit-background';
const DEFAULT_TINT: BackgroundTint = 'indigo';
const DEFAULT_DARK_SHADE: BackgroundShade = 'dark-black';
const DEFAULT_LIGHT_SHADE: BackgroundShade = 'light-white';
const SHADE_IDS = new Set<BackgroundShade>([...BACKGROUND_DARK_SHADES, ...BACKGROUND_LIGHT_SHADES].map((entry) => entry.id));

function migrateShade(value: unknown, fallback: BackgroundShade): BackgroundShade {
  if (typeof value === 'string' && SHADE_IDS.has(value as BackgroundShade)) return value as BackgroundShade;
  if (value === 'black' || value === 'charcoal' || value === 'slate' || value === 'grey') return `dark-${value}` as BackgroundShade;
  if (value === 'sepia') return 'light-sepia';
  return fallback;
}

function loadStoredSettings(): { tint: BackgroundTint; darkShade: BackgroundShade; lightShade: BackgroundShade } {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { tint?: unknown; shade?: unknown; darkShade?: unknown; lightShade?: unknown };
    const tint = typeof stored.tint === 'string' && stored.tint in BACKGROUND_TINTS ? stored.tint as BackgroundTint : DEFAULT_TINT;
    const migratedShade = migrateShade(stored.shade, DEFAULT_DARK_SHADE);
    const darkShade = migrateShade(stored.darkShade, migratedShade.startsWith('dark-') ? migratedShade : DEFAULT_DARK_SHADE);
    const lightShade = migrateShade(stored.lightShade, migratedShade.startsWith('light-') ? migratedShade : DEFAULT_LIGHT_SHADE);
    return { tint, darkShade, lightShade };
  } catch {
    return { tint: DEFAULT_TINT, darkShade: DEFAULT_DARK_SHADE, lightShade: DEFAULT_LIGHT_SHADE };
  }
}

const BackgroundSettingsContext = createContext<BackgroundSettingsContextValue | null>(null);

export function BackgroundSettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const { theme } = useTheme();
  const stored = useMemo(loadStoredSettings, []);
  const [tint, setTint] = useState<BackgroundTint>(stored.tint);
  const [darkShade, setDarkShade] = useState<BackgroundShade>(stored.darkShade);
  const [lightShade, setLightShade] = useState<BackgroundShade>(stored.lightShade);
  const shade = theme === 'dark' ? darkShade : lightShade;

  useEffect(() => {
    document.documentElement.style.setProperty('--bg', getBackgroundShadeColor(shade));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tint, darkShade, lightShade }));
  }, [tint, darkShade, lightShade, shade]);

  const value = useMemo(() => ({ tint, darkShade, lightShade, setTint, setDarkShade, setLightShade }), [tint, darkShade, lightShade]);
  return <BackgroundSettingsContext.Provider value={value}>{children}</BackgroundSettingsContext.Provider>;
}

export function useBackgroundSettings(): BackgroundSettingsContextValue {
  const context = useContext(BackgroundSettingsContext);
  if (!context) throw new Error('useBackgroundSettings must be used within BackgroundSettingsProvider');
  return context;
}
