import type { SettingControl } from './effectSettings';

// Settings panel controls for Ferrofluid — colors is an array prop, exposed
// as three indexed color pickers.

export const CONTROLS: SettingControl[] = [
  { kind: 'color', key: 'colors0', label: 'Color 1', default: '#ffffff', prop: 'colors', index: 0 },
  { kind: 'color', key: 'colors1', label: 'Color 2', default: '#ffffff', prop: 'colors', index: 1 },
  { kind: 'color', key: 'colors2', label: 'Color 3', default: '#ffffff', prop: 'colors', index: 2 },
  { kind: 'number', key: 'speed', label: 'Speed', default: 0.5, min: 0, max: 2, step: 0.01 },
  { kind: 'number', key: 'scale', label: 'Scale', default: 1.6, min: 0.2, max: 5, step: 0.05 },
  { kind: 'number', key: 'turbulence', label: 'Turbulence', default: 1, min: 0, max: 3, step: 0.05 },
  { kind: 'number', key: 'fluidity', label: 'Fluidity', default: 0.1, min: 0.01, max: 1, step: 0.01 },
  { kind: 'number', key: 'rimWidth', label: 'Rim width', default: 0.2, min: 0.05, max: 0.5, step: 0.01 },
  { kind: 'number', key: 'sharpness', label: 'Sharpness', default: 2.5, min: 0.5, max: 8, step: 0.1 },
  { kind: 'number', key: 'shimmer', label: 'Shimmer', default: 1.5, min: 0, max: 5, step: 0.05 },
  { kind: 'number', key: 'glow', label: 'Glow', default: 2, min: 0, max: 6, step: 0.1 },
  {
    kind: 'select',
    key: 'flowDirection',
    label: 'Flow direction',
    default: 'down',
    options: [
      { value: 'up', label: 'Up' },
      { value: 'down', label: 'Down' },
      { value: 'left', label: 'Left' },
      { value: 'right', label: 'Right' },
    ],
  },
  { kind: 'number', key: 'opacity', label: 'Opacity', default: 1, min: 0, max: 1, step: 0.01 },
  {
    kind: 'select',
    key: 'mixBlendMode',
    label: 'Blend mode',
    default: 'normal',
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'multiply', label: 'Multiply' },
      { value: 'screen', label: 'Screen' },
      { value: 'overlay', label: 'Overlay' },
      { value: 'lighten', label: 'Lighten' },
      { value: 'darken', label: 'Darken' },
      { value: 'color-dodge', label: 'Color dodge' },
      { value: 'difference', label: 'Difference' },
    ],
  },
  { kind: 'boolean', key: 'mouseInteraction', label: 'Mouse interaction', default: true },
  { kind: 'number', key: 'mouseStrength', label: 'Mouse strength', default: 1, min: 0, max: 3, step: 0.05 },
  { kind: 'number', key: 'mouseRadius', label: 'Mouse radius', default: 0.35, min: 0.05, max: 1.5, step: 0.01 },
  { kind: 'number', key: 'mouseDampening', label: 'Mouse dampening', default: 0.15, min: 0, max: 1, step: 0.01 },
];
