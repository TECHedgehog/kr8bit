import type { SettingControl } from './effectSettings';

// Settings panel controls for LetterGlitch — glitchColors is an array prop,
// exposed as three indexed color pickers.

export const CONTROLS: SettingControl[] = [
  { kind: 'color', key: 'glitchColors0', label: 'Glitch color 1', default: '#2b4539', prop: 'glitchColors', index: 0 },
  { kind: 'color', key: 'glitchColors1', label: 'Glitch color 2', default: '#61dca3', prop: 'glitchColors', index: 1 },
  { kind: 'color', key: 'glitchColors2', label: 'Glitch color 3', default: '#61b3dc', prop: 'glitchColors', index: 2 },
  { kind: 'number', key: 'glitchSpeed', label: 'Glitch speed', default: 50, min: 10, max: 500, step: 5 },
  { kind: 'boolean', key: 'centerVignette', label: 'Center vignette', default: false },
  { kind: 'boolean', key: 'outerVignette', label: 'Outer vignette', default: true },
  { kind: 'boolean', key: 'smooth', label: 'Smooth', default: true },
  { kind: 'boolean', key: 'lightMode', label: 'Light mode', default: false },
  { kind: 'color', key: 'backgroundColor', label: 'Background color', default: '#000000' },
  { kind: 'text', key: 'characters', label: 'Characters', default: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789' },
];
