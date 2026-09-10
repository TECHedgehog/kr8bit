import { lazy, Suspense } from 'react';

import { CONTROLS as ditherControls } from './Dither.settings';
import { type DitherProps } from './Dither';
import { FaultyTerminal, type FaultyTerminalProps } from './FaultyTerminal';
import { CONTROLS as faultyTerminalControls } from './FaultyTerminal.settings';
import {
  paramsToProps,
  type EffectParams,
  type SettingControl,
} from './effectSettings';

// Dither pulls in the three.js stack (~600KB) — lazy-load it so the
// main bundle stays clean; only selecting/previewing Dither fetches it.
const LazyDither = lazy(() =>
  import('./Dither').then((m) => ({ default: m.Dither })),
);

// Global background effect catalog. Entries render app-wide through
// GlobalEffectsLayer using params stored in EffectsSettingsContext.

export type EffectCategory = 'text' | 'animation' | 'background';

export interface EffectEntry {
  id: string;
  name: string;
  category: EffectCategory;
  /** Settings panel controls; empty for demo effects. */
  controls: SettingControl[];
  /** Render with the user's tweaked params (absent keys = defaults). */
  render: (params: EffectParams) => JSX.Element;
}

/** Globally selectable backgrounds — one active at a time (id or null). */
export const BACKGROUND_EFFECTS: EffectEntry[] = [
  {
    id: 'dither',
    name: 'Dither',
    category: 'background',
    controls: ditherControls,
    render: (params) => (
      <Suspense fallback={null}>
        <LazyDither {...paramsToProps<DitherProps>(ditherControls, params)} />
      </Suspense>
    ),
  },
  {
    id: 'faultyterminal',
    name: 'Faulty Terminal',
    category: 'background',
    controls: faultyTerminalControls,
    render: (params) => (
      <FaultyTerminal {...paramsToProps<FaultyTerminalProps>(faultyTerminalControls, params)} />
    ),
  },
];
