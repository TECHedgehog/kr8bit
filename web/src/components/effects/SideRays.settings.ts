import type { SettingControl } from './effectSettings';

// Settings panel controls for SideRays.

export const CONTROLS: SettingControl[] = [
  { kind: 'number', key: 'speed', label: 'Speed', default: 2.5, min: 0, max: 10, step: 0.1 },
  { kind: 'color', key: 'rayColor1', label: 'Ray color 1', default: '#EAB308' },
  { kind: 'color', key: 'rayColor2', label: 'Ray color 2', default: '#96c8ff' },
  { kind: 'number', key: 'intensity', label: 'Intensity', default: 2, min: 0, max: 6, step: 0.1 },
  { kind: 'number', key: 'spread', label: 'Spread', default: 2, min: 0.2, max: 6, step: 0.1 },
  {
    kind: 'select',
    key: 'origin',
    label: 'Origin',
    default: 'top-right',
    options: [
      { value: 'top-left', label: 'Top left' },
      { value: 'top-right', label: 'Top right' },
      { value: 'bottom-left', label: 'Bottom left' },
      { value: 'bottom-right', label: 'Bottom right' },
    ],
  },
  { kind: 'number', key: 'tilt', label: 'Tilt', default: 0, min: -45, max: 45, step: 1 },
  { kind: 'number', key: 'saturation', label: 'Saturation', default: 1.5, min: 0, max: 3, step: 0.05 },
  { kind: 'number', key: 'blend', label: 'Blend', default: 0.75, min: 0, max: 1, step: 0.01 },
  { kind: 'number', key: 'falloff', label: 'Falloff', default: 1.6, min: 0.5, max: 3, step: 0.05 },
  { kind: 'number', key: 'opacity', label: 'Opacity', default: 1.0, min: 0, max: 1, step: 0.01 },
];
