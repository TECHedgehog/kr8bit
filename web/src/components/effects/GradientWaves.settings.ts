import type { SettingControl } from './effectSettings';

// Settings panel controls for GradientWaves — every visual/behavioral prop
// from the react-bits port (defaults verbatim). Ranges follow upstream docs
// where they exist, else 0–2× default.

export const CONTROLS: SettingControl[] = [
  { kind: 'color', key: 'horizonColor', label: 'Horizon color', default: '#5227FF' },
  { kind: 'color', key: 'waveColor', label: 'Wave color', default: '#FF9FFC' },
  { kind: 'color', key: 'crestColor', label: 'Crest color', default: '#FFFFFF' },
  { kind: 'number', key: 'speed', label: 'Speed', default: 0.4, min: 0, max: 2, step: 0.01 },
  { kind: 'number', key: 'amplitude', label: 'Amplitude', default: 2.5, min: 0, max: 10, step: 0.1 },
  { kind: 'number', key: 'waveScale', label: 'Wave scale', default: 0.6, min: 0.1, max: 3, step: 0.01 },
  { kind: 'number', key: 'waveRatio', label: 'Wave ratio', default: 0.9, min: 0.1, max: 3, step: 0.01 },
  { kind: 'number', key: 'swell', label: 'Swell', default: 35, min: 0, max: 100, step: 1 },
  { kind: 'number', key: 'turbulence', label: 'Turbulence', default: 20, min: 0, max: 100, step: 1 },
  { kind: 'number', key: 'tilt', label: 'Tilt', default: 1.11, min: -3.14, max: 3.14, step: 0.01 },
  { kind: 'number', key: 'zoom', label: 'Zoom', default: 1.0, min: 0.2, max: 3, step: 0.01 },
  { kind: 'number', key: 'height', label: 'Height', default: 5.5, min: 0, max: 20, step: 0.1 },
  { kind: 'number', key: 'fogDepth', label: 'Fog depth', default: 15, min: 1, max: 60, step: 1 },
  {
    kind: 'select',
    key: 'detail',
    label: 'Detail',
    default: 'medium',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
  },
  { kind: 'number', key: 'brightness', label: 'Brightness', default: 1.0, min: 0, max: 2, step: 0.01 },
  { kind: 'number', key: 'opacity', label: 'Opacity', default: 1.0, min: 0, max: 1, step: 0.01 },
  { kind: 'boolean', key: 'mouseInteraction', label: 'Mouse interaction', default: true },
  { kind: 'number', key: 'parallaxStrength', label: 'Parallax strength', default: 0.5, min: 0, max: 2, step: 0.01 },
  { kind: 'boolean', key: 'grain', label: 'Grain', default: true },
  { kind: 'number', key: 'grainIntensity', label: 'Grain intensity', default: 0.05, min: 0, max: 0.5, step: 0.005 },
];
