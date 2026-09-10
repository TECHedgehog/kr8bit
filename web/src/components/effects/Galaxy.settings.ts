import type { SettingControl } from './effectSettings';

// Settings panel controls for Galaxy — focal/rotation are vec2 array props,
// exposed as indexed number sliders.

export const CONTROLS: SettingControl[] = [
  { kind: 'number', key: 'focal0', label: 'Focal X', default: 0.5, min: 0, max: 1, step: 0.01, prop: 'focal', index: 0 },
  { kind: 'number', key: 'focal1', label: 'Focal Y', default: 0.5, min: 0, max: 1, step: 0.01, prop: 'focal', index: 1 },
  { kind: 'number', key: 'rotation0', label: 'Rotation X', default: 1.0, min: -1, max: 1, step: 0.01, prop: 'rotation', index: 0 },
  { kind: 'number', key: 'rotation1', label: 'Rotation Y', default: 0.0, min: -1, max: 1, step: 0.01, prop: 'rotation', index: 1 },
  { kind: 'number', key: 'starSpeed', label: 'Star speed', default: 0.5, min: 0, max: 2, step: 0.01 },
  { kind: 'number', key: 'density', label: 'Density', default: 1, min: 0.2, max: 3, step: 0.05 },
  { kind: 'number', key: 'hueShift', label: 'Hue shift', default: 140, min: 0, max: 360, step: 1 },
  { kind: 'boolean', key: 'disableAnimation', label: 'Disable animation', default: false },
  { kind: 'number', key: 'speed', label: 'Speed', default: 1.0, min: 0, max: 5, step: 0.01 },
  { kind: 'boolean', key: 'mouseInteraction', label: 'Mouse interaction', default: true },
  { kind: 'number', key: 'glowIntensity', label: 'Glow intensity', default: 0.3, min: 0, max: 2, step: 0.01 },
  { kind: 'number', key: 'saturation', label: 'Saturation', default: 0, min: 0, max: 2, step: 0.01 },
  { kind: 'boolean', key: 'mouseRepulsion', label: 'Mouse repulsion', default: true },
  { kind: 'number', key: 'repulsionStrength', label: 'Repulsion strength', default: 2, min: 0, max: 10, step: 0.1 },
  { kind: 'number', key: 'twinkleIntensity', label: 'Twinkle intensity', default: 0.3, min: 0, max: 1, step: 0.01 },
  { kind: 'number', key: 'rotationSpeed', label: 'Rotation speed', default: 0.1, min: -1, max: 1, step: 0.01 },
  { kind: 'number', key: 'autoCenterRepulsion', label: 'Auto center repulsion', default: 0, min: 0, max: 5, step: 0.05 },
  { kind: 'boolean', key: 'transparent', label: 'Transparent', default: true },
  { kind: 'boolean', key: 'lightMode', label: 'Light mode', default: false },
];
