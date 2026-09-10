import type { Theme } from '../../context/ThemeContext';
import type { EffectParamsMap } from '../../context/EffectsSettingsContext';

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
