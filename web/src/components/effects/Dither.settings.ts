import type { SettingControl } from './effectSettings';

// Settings panel controls for Dither — waveColor/backgroundColor are rgb
// tuples (0–1) upstream, exposed as hex pickers and converted on assemble.

export const CONTROLS: SettingControl[] = [
  { kind: 'number', key: 'waveSpeed', label: 'Wave speed', default: 0.05, min: 0, max: 1, step: 0.01 },
  { kind: 'number', key: 'waveFrequency', label: 'Wave frequency', default: 3, min: 0.5, max: 8, step: 0.1 },
  { kind: 'number', key: 'waveAmplitude', label: 'Wave amplitude', default: 0.3, min: 0.1, max: 0.9, step: 0.01 },
  { kind: 'color', key: 'waveColor', label: 'Wave color', default: '#8288fe', as: 'rgb' },
  { kind: 'color', key: 'backgroundColor', label: 'Background color', default: '#08090c', as: 'rgb' },
  { kind: 'number', key: 'colorNum', label: 'Color steps', default: 4, min: 2, max: 16, step: 1 },
  { kind: 'number', key: 'pixelSize', label: 'Pixel size', default: 2, min: 0.5, max: 8, step: 0.5 },
  { kind: 'boolean', key: 'disableAnimation', label: 'Disable animation', default: false },
  { kind: 'boolean', key: 'enableMouseInteraction', label: 'Mouse interaction', default: true },
  { kind: 'number', key: 'mouseRadius', label: 'Mouse radius', default: 1, min: 0.1, max: 3, step: 0.05 },
];
