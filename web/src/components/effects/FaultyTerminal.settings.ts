import type { SettingControl } from './effectSettings';

// Settings panel controls for FaultyTerminal — gridMul is a vec2 array prop,
// exposed as two indexed number sliders. dither is number|boolean upstream;
// exposed as a 0–255 slider (the numeric form).

export const CONTROLS: SettingControl[] = [
  { kind: 'number', key: 'scale', label: 'Scale', default: 1, min: 0.2, max: 3, step: 0.05 },
  { kind: 'number', key: 'gridMul0', label: 'Grid X', default: 2, min: 0.5, max: 6, step: 0.1, prop: 'gridMul', index: 0 },
  { kind: 'number', key: 'gridMul1', label: 'Grid Y', default: 1, min: 0.5, max: 6, step: 0.1, prop: 'gridMul', index: 1 },
  { kind: 'number', key: 'digitSize', label: 'Digit size', default: 1.5, min: 0.5, max: 4, step: 0.05 },
  { kind: 'number', key: 'timeScale', label: 'Time scale', default: 0.3, min: 0, max: 2, step: 0.01 },
  { kind: 'boolean', key: 'pause', label: 'Pause', default: false },
  { kind: 'number', key: 'scanlineIntensity', label: 'Scanline intensity', default: 0.3, min: 0, max: 1, step: 0.01 },
  { kind: 'number', key: 'glitchAmount', label: 'Glitch amount', default: 1, min: 0, max: 3, step: 0.05 },
  { kind: 'number', key: 'flickerAmount', label: 'Flicker amount', default: 1, min: 0, max: 3, step: 0.05 },
  { kind: 'number', key: 'noiseAmp', label: 'Noise amp', default: 1, min: 0, max: 3, step: 0.05 },
  { kind: 'number', key: 'chromaticAberration', label: 'Chromatic aberration', default: 0, min: 0, max: 0.02, step: 0.0005 },
  { kind: 'number', key: 'dither', label: 'Dither', default: 0, min: 0, max: 255, step: 1 },
  { kind: 'number', key: 'curvature', label: 'Curvature', default: 0.2, min: -0.5, max: 0.5, step: 0.01 },
  { kind: 'color', key: 'tint', label: 'Tint', default: '#ffffff' },
  { kind: 'boolean', key: 'mouseReact', label: 'Mouse react', default: true },
  { kind: 'number', key: 'mouseStrength', label: 'Mouse strength', default: 0.2, min: 0, max: 1, step: 0.01 },
  { kind: 'boolean', key: 'pageLoadAnimation', label: 'Page load animation', default: true },
  { kind: 'number', key: 'brightness', label: 'Brightness', default: 1, min: 0.2, max: 3, step: 0.01 },
  { kind: 'boolean', key: 'lightMode', label: 'Light mode', default: false },
];
