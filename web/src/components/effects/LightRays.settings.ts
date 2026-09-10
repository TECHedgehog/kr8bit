import type { SettingControl } from './effectSettings';

// Settings panel controls for LightRays.

const ORIGINS = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' },
];

export const CONTROLS: SettingControl[] = [
  { kind: 'select', key: 'raysOrigin', label: 'Rays origin', default: 'top-center', options: ORIGINS },
  { kind: 'color', key: 'raysColor', label: 'Rays color', default: '#ffffff' },
  { kind: 'number', key: 'raysSpeed', label: 'Rays speed', default: 1, min: 0, max: 5, step: 0.01 },
  { kind: 'number', key: 'lightSpread', label: 'Light spread', default: 1, min: 0.1, max: 5, step: 0.05 },
  { kind: 'number', key: 'rayLength', label: 'Ray length', default: 2, min: 0.5, max: 5, step: 0.1 },
  { kind: 'boolean', key: 'pulsating', label: 'Pulsating', default: false },
  { kind: 'number', key: 'fadeDistance', label: 'Fade distance', default: 1.0, min: 0.2, max: 3, step: 0.05 },
  { kind: 'number', key: 'saturation', label: 'Saturation', default: 1.0, min: 0, max: 3, step: 0.01 },
  { kind: 'boolean', key: 'followMouse', label: 'Follow mouse', default: true },
  { kind: 'number', key: 'mouseInfluence', label: 'Mouse influence', default: 0.1, min: 0, max: 1, step: 0.01 },
  { kind: 'number', key: 'noiseAmount', label: 'Noise amount', default: 0.0, min: 0, max: 1, step: 0.01 },
  { kind: 'number', key: 'distortion', label: 'Distortion', default: 0.0, min: 0, max: 1, step: 0.01 },
  { kind: 'boolean', key: 'lightMode', label: 'Light mode', default: false },
];
