import { useEffect } from 'react';
import { BACKGROUND_EFFECTS, CURSOR_EFFECTS } from './catalog';
import { useEffectsSettings } from '../../context/EffectsSettingsContext';

// Renders the globally selected background + cursor effects from
// EffectsSettingsContext. Mounted once in AppLayout so every route
// gets them. Unknown ids (e.g. an effect removed in a later version)
// render nothing — the stored setting is effectively ignored. The
// per-effect params tweaked on /glass-test apply here too, so the app
// background/cursor always matches the last preview.

/** Blob cursor replaces the native cursor app-wide while it is active. */
const CURSOR_HIDES_NATIVE = 'blobcursor';

export function GlobalEffectsLayer(): JSX.Element | null {
  const { background, cursor, params } = useEffectsSettings();

  const backgroundEntry =
    background !== null
      ? BACKGROUND_EFFECTS.find((entry) => entry.id === background)
      : undefined;
  const cursorEntry =
    cursor !== null
      ? CURSOR_EFFECTS.find((entry) => entry.id === cursor)
      : undefined;

  // Hide the native cursor only for effects that replace it, and only
  // while that effect is active. Cleanup always restores it.
  useEffect(() => {
    const hide = cursor === CURSOR_HIDES_NATIVE;
    document.documentElement.classList.toggle('kr8bit-hide-cursor', hide);
    return () => {
      document.documentElement.classList.remove('kr8bit-hide-cursor');
    };
  }, [cursor]);

  if (!backgroundEntry && !cursorEntry) return null;

  return (
    <>
      {backgroundEntry && (
        <div className="global-effects-bg" aria-hidden="true">
          {backgroundEntry.render(params[backgroundEntry.id] ?? {})}
        </div>
      )}
      {cursorEntry && (
        <div className="global-effects-cursor" aria-hidden="true">
          {cursorEntry.render(params[cursorEntry.id] ?? {})}
        </div>
      )}
    </>
  );
}
