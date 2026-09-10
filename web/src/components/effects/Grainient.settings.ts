import type { SettingControl } from './effectSettings';

// Settings panel controls for Grainient.

export const CONTROLS: SettingControl[] = [
  { kind: 'number', key: 'timeSpeed', label: 'Time speed', default: 0.25, min: 0, max: 2, step: 0.01 },
  { kind: 'number', key: 'colorBalance', label: 'Color balance', default: 0, min: -1, max: 1, step: 0.01 },
  { kind: 'number', key: 'warpStrength', label: 'Warp strength', default: 1.0, min: 0.1, max: 5, step: 0.05 },
  { kind: 'number', key: 'warpFrequency', label: 'Warp frequency', default: 5.0, min: 0.5, max: 20, step: 0.5 },
  { kind: 'number', key: 'warpSpeed', label: 'Warp speed', default: 2.0, min: 0, max: 10, step: 0.1 },
  { kind: 'number', key: 'warpAmplitude', label: 'Warp amplitude', default: 50.0, min: 1, max: 200, step: 1 },
  { kind: 'number', key: 'blendAngle', label: 'Blend angle', default: 0, min: -180, max: 180, step: 1 },
  { kind: 'number', key: 'blendSoftness', label: 'Blend softness', default: 0.05, min: 0, max: 0.5, step: 0.01 },
  { kind: 'number', key: 'rotationAmount', label: 'Rotation amount', default: 500.0, min: 0, max: 1000, step: 10 },
  { kind: 'number', key: 'noiseScale', label: 'Noise scale', default: 2.0, min: 0.5, max: 10, step: 0.1 },
  { kind: 'number', key: 'grainAmount', label: 'Grain amount', default: 0.1, min: 0, max: 1, step: 0.01 },
  { kind: 'number', key: 'grainScale', label: 'Grain scale', default: 2.0, min: 0.5, max: 10, step: 0.1 },
  { kind: 'boolean', key: 'grainAnimated', label: 'Animated grain', default: false },
  { kind: 'number', key: 'contrast', label: 'Contrast', default: 1.5, min: 0.5, max: 3, step: 0.01 },
  { kind: 'number', key: 'gamma', label: 'Gamma', default: 1.0, min: 0.25, max: 4, step: 0.01 },
  { kind: 'number', key: 'saturation', label: 'Saturation', default: 1.0, min: 0, max: 3, step: 0.01 },
  { kind: 'number', key: 'centerX', label: 'Center X', default: 0, min: -0.5, max: 0.5, step: 0.01 },
  { kind: 'number', key: 'centerY', label: 'Center Y', default: 0, min: -0.5, max: 0.5, step: 0.01 },
  { kind: 'number', key: 'zoom', label: 'Zoom', default: 0.9, min: 0.2, max: 3, step: 0.01 },
  { kind: 'color', key: 'color1', label: 'Color 1', default: '#FF9FFC' },
  { kind: 'color', key: 'color2', label: 'Color 2', default: '#5227FF' },
  { kind: 'color', key: 'color3', label: 'Color 3', default: '#B497CF' },
  { kind: 'boolean', key: 'lightMode', label: 'Light mode', default: false },
];
