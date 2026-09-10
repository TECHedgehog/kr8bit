import { lazy, Suspense } from 'react';

import { ClickSpark } from './ClickSpark';
import { CONTROLS as ditherControls } from './Dither.settings';
import { type DitherProps } from './Dither';
import { FaultyTerminal, type FaultyTerminalProps } from './FaultyTerminal';
import { CONTROLS as faultyTerminalControls } from './FaultyTerminal.settings';
import { GradientText } from './GradientText';
import { Magnet } from './Magnet';
import { Noise } from './Noise';
import { ShinyText } from './ShinyText';
import { StarBorder } from './StarBorder';
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

// Effect catalog for /glass-test. Split into three groups:
//   - DEMO_EFFECTS: playground-only previews, no global toggle (yet)
//   - BACKGROUND_EFFECTS: single-select global app background
// The background group is rendered app-wide by GlobalEffectsLayer
// (AppLayout) using the ids stored in EffectsSettingsContext. Entries
// render with the per-effect params persisted in that context, so the
// preview tiles and the global layer always match.

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

const NO_CONTROLS: SettingControl[] = [];

/** Playground-only demos — evaluated here, not wired to the app. */
export const DEMO_EFFECTS: EffectEntry[] = [
  {
    id: 'shiny',
    name: 'Shiny Text',
    category: 'text',
    controls: NO_CONTROLS,
    render: () => <ShinyText text="SHINY TEXT" />,
  },
  {
    id: 'gradient',
    name: 'Gradient Text',
    category: 'text',
    controls: NO_CONTROLS,
    render: () => <GradientText>GRADIENT</GradientText>,
  },
  {
    id: 'clickspark',
    name: 'Click Spark',
    category: 'animation',
    controls: NO_CONTROLS,
    render: () => (
      <ClickSpark>
        <div className="glass-test-effect-fill">
          <span className="glass-test-effect-hint">click anywhere in this tile</span>
        </div>
      </ClickSpark>
    ),
  },
  {
    id: 'starborder',
    name: 'Star Border',
    category: 'animation',
    controls: NO_CONTROLS,
    render: () => <StarBorder>STAR BADGE</StarBorder>,
  },
  {
    id: 'magnet',
    name: 'Magnet',
    category: 'animation',
    controls: NO_CONTROLS,
    render: () => (
      <Magnet>
        <button type="button" className="glass-test-btn">
          move pointer near
        </button>
      </Magnet>
    ),
  },
  {
    id: 'noise',
    name: 'Noise',
    category: 'animation',
    controls: NO_CONTROLS,
    render: () => (
      <>
        <span className="glass-test-effect-hint">film grain</span>
        <Noise />
      </>
    ),
  },
];

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
