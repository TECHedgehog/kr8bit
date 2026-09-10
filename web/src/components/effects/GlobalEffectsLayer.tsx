import { BACKGROUND_EFFECTS } from './catalog';
import { useEffectsSettings } from '../../context/EffectsSettingsContext';
import { usePerformanceSettings } from '../../context/PerformanceSettingsContext';

// Renders the globally selected background effect from
// EffectsSettingsContext. Mounted once in AppLayout so every route
// gets them. Unknown ids (e.g. an effect removed in a later version)
// render nothing — the stored setting is effectively ignored.

export function GlobalEffectsLayer(): JSX.Element | null {
  const { background, params } = useEffectsSettings();
  const { backgroundEffects } = usePerformanceSettings();
  if (!backgroundEffects) return null;

  const backgroundEntry =
    background !== null
      ? BACKGROUND_EFFECTS.find((entry) => entry.id === background)
      : undefined;
  if (!backgroundEntry) return null;

  return (
    <>
      {backgroundEntry && (
        <div className="global-effects-bg" aria-hidden="true">
          {backgroundEntry.render(params[backgroundEntry.id] ?? {})}
        </div>
      )}
    </>
  );
}
