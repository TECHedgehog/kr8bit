import type { SettingControl } from './effectSettings';

// Settings panel controls for Aurora — colorStops is an array prop, exposed
// as three indexed color pickers assembled back into the prop.

export const CONTROLS: SettingControl[] = [
  { kind: 'color', key: 'colorStops0', label: 'Color stop 1', default: '#5227FF', prop: 'colorStops', index: 0 },
  { kind: 'color', key: 'colorStops1', label: 'Color stop 2', default: '#7cff67', prop: 'colorStops', index: 1 },
  { kind: 'color', key: 'colorStops2', label: 'Color stop 3', default: '#5227FF', prop: 'colorStops', index: 2 },
  { kind: 'number', key: 'amplitude', label: 'Amplitude', default: 1.0, min: 0, max: 3, step: 0.01 },
  { kind: 'number', key: 'blend', label: 'Blend', default: 0.5, min: 0, max: 1, step: 0.01 },
  { kind: 'number', key: 'speed', label: 'Speed', default: 1.0, min: 0, max: 5, step: 0.01 },
  { kind: 'boolean', key: 'lightMode', label: 'Light mode', default: false },
];
