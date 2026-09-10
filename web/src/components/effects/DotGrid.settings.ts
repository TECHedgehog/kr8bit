import type { SettingControl } from './effectSettings';

// Settings panel controls for DotGrid.

export const CONTROLS: SettingControl[] = [
  { kind: 'number', key: 'dotSize', label: 'Dot size', default: 16, min: 2, max: 40, step: 1 },
  { kind: 'number', key: 'gap', label: 'Gap', default: 32, min: 0, max: 100, step: 1 },
  { kind: 'color', key: 'baseColor', label: 'Base color', default: '#5227FF' },
  { kind: 'color', key: 'activeColor', label: 'Active color', default: '#5227FF' },
  { kind: 'number', key: 'proximity', label: 'Proximity', default: 150, min: 0, max: 400, step: 5 },
  { kind: 'number', key: 'speedTrigger', label: 'Speed trigger', default: 100, min: 0, max: 1000, step: 10 },
  { kind: 'number', key: 'shockRadius', label: 'Shock radius', default: 250, min: 0, max: 600, step: 10 },
  { kind: 'number', key: 'shockStrength', label: 'Shock strength', default: 5, min: 0, max: 20, step: 0.5 },
  { kind: 'number', key: 'maxSpeed', label: 'Max speed', default: 5000, min: 100, max: 10000, step: 100 },
  { kind: 'number', key: 'resistance', label: 'Resistance', default: 750, min: 50, max: 2000, step: 50 },
  { kind: 'number', key: 'returnDuration', label: 'Return duration', default: 1.5, min: 0.1, max: 5, step: 0.1 },
];
