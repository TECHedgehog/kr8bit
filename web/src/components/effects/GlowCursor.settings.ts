import type { SettingControl } from './effectSettings';

// Settings panel controls for GlowCursor.

export const CONTROLS: SettingControl[] = [
  { kind: 'color', key: 'color', label: 'Color', default: '#67E8F9' },
  { kind: 'color', key: 'secondaryColor', label: 'Secondary color', default: '#A78BFA' },
  { kind: 'number', key: 'trailLength', label: 'Trail length', default: 40, min: 2, max: 64, step: 1 },
  { kind: 'number', key: 'trailWidth', label: 'Trail width', default: 8, min: 0.5, max: 40, step: 0.5 },
  { kind: 'number', key: 'trailTaper', label: 'Trail taper', default: 0.8, min: 0, max: 1, step: 0.01 },
  { kind: 'number', key: 'followSpeed', label: 'Follow speed', default: 0.16, min: 0.01, max: 0.95, step: 0.01 },
  { kind: 'number', key: 'glowIntensity', label: 'Glow intensity', default: 1.9, min: 0, max: 5, step: 0.05 },
  { kind: 'number', key: 'glowSpread', label: 'Glow spread', default: 1.2, min: 0, max: 4, step: 0.05 },
  { kind: 'number', key: 'hotspot', label: 'Hotspot', default: 0.65, min: 0, max: 1, step: 0.01 },
  { kind: 'number', key: 'brightness', label: 'Brightness', default: 1.25, min: 0, max: 3, step: 0.01 },
  { kind: 'number', key: 'opacity', label: 'Opacity', default: 1, min: 0, max: 1, step: 0.01 },
  { kind: 'number', key: 'pulseSpeed', label: 'Pulse speed', default: 1.1, min: 0, max: 5, step: 0.05 },
  { kind: 'number', key: 'noiseStrength', label: 'Noise strength', default: 0.035, min: 0, max: 0.3, step: 0.005 },
  { kind: 'boolean', key: 'idleFade', label: 'Idle fade', default: true },
  { kind: 'number', key: 'idleTimeout', label: 'Idle timeout (ms)', default: 700, min: 100, max: 5000, step: 50 },
  { kind: 'number', key: 'fadeDuration', label: 'Fade duration (ms)', default: 900, min: 100, max: 5000, step: 50 },
  {
    kind: 'select',
    key: 'blendMode',
    label: 'Blend mode',
    default: 'screen',
    options: [
      { value: 'screen', label: 'Screen' },
      { value: 'normal', label: 'Normal' },
    ],
  },
  { kind: 'boolean', key: 'enabled', label: 'Enabled', default: true },
];
