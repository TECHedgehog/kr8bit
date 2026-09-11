import type { Theme } from '../../context/ThemeContext';
import type { EffectParamsMap } from '../../context/EffectsSettingsContext';
import type { BackgroundTint } from '../../context/BackgroundSettingsContext';
import type { EffectParams } from './effectSettings';

export interface DitherPreset {
  values: EffectParams;
  invertColors: boolean;
  opacity: number;
}

const DITHER_PRESETS: Record<Theme, Record<BackgroundTint, DitherPreset>> = {
  dark: {
    indigo: { values: { waveFrequency: 0.5, waveSpeed: 0.04, waveAmplitude: 0.1, waveColor: '#474985', colorNum: 7, mouseRadius: 0.15, disableAnimation: false }, invertColors: false, opacity: 0.75 },
    violet: { values: { waveFrequency: 0.5, waveSpeed: 0.04, waveAmplitude: 0.1, colorNum: 7, mouseRadius: 0.15, disableAnimation: false, waveColor: '#674688' }, invertColors: false, opacity: 0.75 },
    teal: { values: { waveFrequency: 0.5, waveSpeed: 0.04, waveAmplitude: 0.1, colorNum: 7, mouseRadius: 0.15, disableAnimation: false, waveColor: '#1c766b' }, invertColors: false, opacity: 0.75 },
    rose: { values: { waveFrequency: 0.5, waveSpeed: 0.04, waveAmplitude: 0.1, colorNum: 7, mouseRadius: 0.15, disableAnimation: false, waveColor: '#883d49' }, invertColors: false, opacity: 0.75 },
    amber: { values: { waveFrequency: 0.5, waveSpeed: 0.04, waveAmplitude: 0.1, colorNum: 7, mouseRadius: 0.15, disableAnimation: false, waveColor: '#866617' }, invertColors: false, opacity: 0.75 },
  },
  light: {
    indigo: { values: { waveSpeed: 0.04, waveAmplitude: 0.11, backgroundColor: '#c8ccd0', waveColor: '#5046eb', waveFrequency: 0.5, colorNum: 7, mouseRadius: 0.15 }, invertColors: false, opacity: 0.51 },
    violet: { values: { waveSpeed: 0.04, waveAmplitude: 0.11, waveFrequency: 0.5, colorNum: 7, mouseRadius: 0.15, waveColor: '#892fdb', backgroundColor: '#cbcfd3' }, invertColors: false, opacity: 0.64 },
    teal: { values: { waveSpeed: 0.04, waveAmplitude: 0.11, waveFrequency: 0.5, colorNum: 7, mouseRadius: 0.15, waveColor: '#079990', backgroundColor: '#d2d6db' }, invertColors: false, opacity: 1 },
    rose: { values: { waveSpeed: 0.04, waveAmplitude: 0.11, waveFrequency: 0.5, colorNum: 7, mouseRadius: 0.15, waveColor: '#f0134d', backgroundColor: '#e7ecf1' }, invertColors: false, opacity: 0.51 },
    amber: { values: { waveSpeed: 0.04, waveAmplitude: 0.11, waveFrequency: 0.5, colorNum: 7, mouseRadius: 0.15, waveColor: '#f6700e', backgroundColor: '#ecf1f6' }, invertColors: false, opacity: 0.51 },
  },
};

export function getDitherPreset(theme: Theme, tint: BackgroundTint): DitherPreset {
  return DITHER_PRESETS[theme][tint];
}

const THEME_EFFECT_PARAMS: Record<Theme, EffectParamsMap> = {
  dark: {
    dither: {
      waveColor: '#964ef5',
      backgroundColor: '#08090c',
    },
    faultyterminal: {
      tint: '#964ef5',
      backgroundColor: '#08090c',
      lightMode: false,
    },
  },
  light: {
    dither: {
      waveColor: '#964ef5',
      backgroundColor: '#e8ebf0',
    },
    faultyterminal: {
      tint: '#964ef5',
      backgroundColor: '#e8ebf0',
      lightMode: true,
    },
  },
};

export function applyThemeEffectParams(theme: Theme, params: EffectParamsMap): EffectParamsMap {
  const themeParams = THEME_EFFECT_PARAMS[theme];
  let changed = false;
  const next = { ...params };

  for (const [effectId, effectParams] of Object.entries(themeParams)) {
    const current = params[effectId] ?? {};
    const merged = { ...current, ...effectParams };
    if (Object.keys(effectParams).some((key) => current[key] !== effectParams[key])) changed = true;
    next[effectId] = merged;
  }

  return changed ? next : params;
}
