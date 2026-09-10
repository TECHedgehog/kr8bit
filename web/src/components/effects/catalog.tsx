import { lazy, Suspense } from 'react';

import { Aurora, type AuroraProps } from './Aurora';
import { CONTROLS as auroraControls } from './Aurora.settings';
import { BlobCursor, type BlobCursorProps } from './BlobCursor';
import { CONTROLS as blobCursorControls } from './BlobCursor.settings';
import { ClickSpark } from './ClickSpark';
import { CONTROLS as ditherControls } from './Dither.settings';
import { type DitherProps } from './Dither';
import { DotField, type DotFieldProps } from './DotField';
import { CONTROLS as dotFieldControls } from './DotField.settings';
import { DotGrid, type DotGridProps } from './DotGrid';
import { CONTROLS as dotGridControls } from './DotGrid.settings';
import { FaultyTerminal, type FaultyTerminalProps } from './FaultyTerminal';
import { CONTROLS as faultyTerminalControls } from './FaultyTerminal.settings';
import { Ferrofluid, type FerrofluidProps } from './Ferrofluid';
import { CONTROLS as ferrofluidControls } from './Ferrofluid.settings';
import { Galaxy, type GalaxyProps } from './Galaxy';
import { CONTROLS as galaxyControls } from './Galaxy.settings';
import { GlowCursor, type GlowCursorProps } from './GlowCursor';
import { CONTROLS as glowCursorControls } from './GlowCursor.settings';
import { GradientText } from './GradientText';
import { GradientWaves, type GradientWavesProps } from './GradientWaves';
import { CONTROLS as gradientWavesControls } from './GradientWaves.settings';
import { Grainient, type GrainientProps } from './Grainient';
import { CONTROLS as grainientControls } from './Grainient.settings';
import { LetterGlitch, type LetterGlitchProps } from './LetterGlitch';
import { CONTROLS as letterGlitchControls } from './LetterGlitch.settings';
import { LightRays, type LightRaysProps } from './LightRays';
import { CONTROLS as lightRaysControls } from './LightRays.settings';
import { Magnet } from './Magnet';
import { Noise } from './Noise';
import { Particles, type ParticlesProps } from './Particles';
import { CONTROLS as particlesControls } from './Particles.settings';
import { ShinyText } from './ShinyText';
import { SideRays, type SideRaysProps } from './SideRays';
import { CONTROLS as sideRaysControls } from './SideRays.settings';
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
//   - CURSOR_EFFECTS: single-select global app cursor
// The global groups are rendered app-wide by GlobalEffectsLayer
// (AppLayout) using the ids stored in EffectsSettingsContext. Entries
// render with the per-effect params persisted in that context, so the
// preview tiles and the global layer always match.

export type EffectCategory = 'text' | 'animation' | 'background' | 'cursor';

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
    id: 'gradientwaves',
    name: 'Gradient Waves',
    category: 'background',
    controls: gradientWavesControls,
    render: (params) => (
      <GradientWaves {...paramsToProps<GradientWavesProps>(gradientWavesControls, params)} />
    ),
  },
  {
    id: 'aurora',
    name: 'Aurora',
    category: 'background',
    controls: auroraControls,
    render: (params) => <Aurora {...paramsToProps<AuroraProps>(auroraControls, params)} />,
  },
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
    id: 'dotfield',
    name: 'Dot Field',
    category: 'background',
    controls: dotFieldControls,
    render: (params) => <DotField {...paramsToProps<DotFieldProps>(dotFieldControls, params)} />,
  },
  {
    id: 'dotgrid',
    name: 'Dot Grid',
    category: 'background',
    controls: dotGridControls,
    render: (params) => <DotGrid {...paramsToProps<DotGridProps>(dotGridControls, params)} />,
  },
  {
    id: 'ferrofluid',
    name: 'Ferrofluid',
    category: 'background',
    controls: ferrofluidControls,
    render: (params) => (
      <Ferrofluid {...paramsToProps<FerrofluidProps>(ferrofluidControls, params)} />
    ),
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    category: 'background',
    controls: galaxyControls,
    render: (params) => <Galaxy {...paramsToProps<GalaxyProps>(galaxyControls, params)} />,
  },
  {
    id: 'grainient',
    name: 'Grainient',
    category: 'background',
    controls: grainientControls,
    render: (params) => (
      <Grainient {...paramsToProps<GrainientProps>(grainientControls, params)} />
    ),
  },
  {
    id: 'lightrays',
    name: 'Light Rays',
    category: 'background',
    controls: lightRaysControls,
    render: (params) => <LightRays {...paramsToProps<LightRaysProps>(lightRaysControls, params)} />,
  },
  {
    id: 'particles',
    name: 'Particles',
    category: 'background',
    controls: particlesControls,
    render: (params) => <Particles {...paramsToProps<ParticlesProps>(particlesControls, params)} />,
  },
  {
    id: 'siderays',
    name: 'Side Rays',
    category: 'background',
    controls: sideRaysControls,
    render: (params) => <SideRays {...paramsToProps<SideRaysProps>(sideRaysControls, params)} />,
  },
  {
    id: 'letterglitch',
    name: 'Letter Glitch',
    category: 'background',
    controls: letterGlitchControls,
    render: (params) => (
      <LetterGlitch {...paramsToProps<LetterGlitchProps>(letterGlitchControls, params)} />
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

/** Globally selectable cursors — one active at a time (id or null). */
export const CURSOR_EFFECTS: EffectEntry[] = [
  {
    id: 'glowcursor',
    name: 'Glow Cursor',
    category: 'cursor',
    controls: glowCursorControls,
    render: (params) => (
      <GlowCursor {...paramsToProps<GlowCursorProps>(glowCursorControls, params)} />
    ),
  },
  {
    id: 'blobcursor',
    name: 'Blob Cursor',
    category: 'cursor',
    controls: blobCursorControls,
    render: (params) => (
      <BlobCursor {...paramsToProps<BlobCursorProps>(blobCursorControls, params)} />
    ),
  },
];
