import { BACKGROUND_EFFECTS } from './catalog';
import { useEffectsSettings } from '../../context/EffectsSettingsContext';
import { usePerformanceSettings } from '../../context/PerformanceSettingsContext';
import { getBackgroundShadeColor, getEffectTint, useBackgroundSettings } from '../../context/BackgroundSettingsContext';
import { getDitherPreset } from './themeEffectColors';
import { useTheme } from '../../context/ThemeContext';

// Renders the globally selected background effect from
// EffectsSettingsContext. Mounted once in AppLayout so every route
// gets them. Unknown ids (e.g. an effect removed in a later version)
// render nothing — the stored setting is effectively ignored.

export function GlobalEffectsLayer(): JSX.Element | null {
  const { background, params } = useEffectsSettings();
  const { backgroundEffects } = usePerformanceSettings();
  const { theme } = useTheme();
  const { tint, darkShade, lightShade } = useBackgroundSettings();
  if (!backgroundEffects) return null;

  const backgroundEntry =
    background !== null
      ? BACKGROUND_EFFECTS.find((entry) => entry.id === background)
      : undefined;
  if (!backgroundEntry) return null;

  const effectParams = { ...(params[backgroundEntry.id] ?? {}) };
  effectParams.backgroundColor = backgroundEntry.id === 'dither'
    ? theme === 'dark' ? '#08090c' : '#e8ebf0'
    : getBackgroundShadeColor(theme === 'dark' ? darkShade : lightShade);
  if (backgroundEntry.id === 'dither') effectParams.waveColor = getEffectTint(theme, tint);
  if (backgroundEntry.id === 'faultyterminal') effectParams.tint = getEffectTint(theme, tint);
  if (backgroundEntry.id === 'dither') {
    const preset = getDitherPreset(theme, tint);
    Object.assign(effectParams, preset.values);
    if (preset.invertColors) {
      const color = effectParams.backgroundColor;
      effectParams.backgroundColor = effectParams.waveColor;
      effectParams.waveColor = color;
    }
  }

  return (
    <>
      {backgroundEntry && (
          <div className="global-effects-bg" aria-hidden="true" style={backgroundEntry.id === 'dither' ? { opacity: getDitherPreset(theme, tint).opacity } : undefined}>
          {backgroundEntry.render(effectParams)}
        </div>
      )}
    </>
  );
}
