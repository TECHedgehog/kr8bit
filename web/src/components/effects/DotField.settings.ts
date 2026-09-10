import type { SettingControl } from './effectSettings';

// Settings panel controls for DotField. gradientFrom/gradientTo/glowColor
// default to rgba() strings upstream; the hex picker loses the alpha channel
// once tweaked (untouched params keep the exact upstream default).

export const CONTROLS: SettingControl[] = [
  { kind: 'number', key: 'dotRadius', label: 'Dot radius', default: 1.5, min: 0.5, max: 6, step: 0.1 },
  { kind: 'number', key: 'dotSpacing', label: 'Dot spacing', default: 14, min: 2, max: 60, step: 1 },
  { kind: 'number', key: 'cursorRadius', label: 'Cursor radius', default: 500, min: 50, max: 1500, step: 10 },
  { kind: 'number', key: 'cursorForce', label: 'Cursor force', default: 0.1, min: 0, max: 1, step: 0.01 },
  { kind: 'boolean', key: 'bulgeOnly', label: 'Bulge only', default: true },
  { kind: 'number', key: 'bulgeStrength', label: 'Bulge strength', default: 67, min: 0, max: 200, step: 1 },
  { kind: 'number', key: 'glowRadius', label: 'Glow radius', default: 160, min: 20, max: 500, step: 10 },
  { kind: 'boolean', key: 'sparkle', label: 'Sparkle', default: false },
  { kind: 'number', key: 'waveAmplitude', label: 'Wave amplitude', default: 0, min: 0, max: 20, step: 0.5 },
  { kind: 'color', key: 'gradientFrom', label: 'Gradient from', default: '#a855f7' },
  { kind: 'color', key: 'gradientTo', label: 'Gradient to', default: '#b497cf' },
  { kind: 'color', key: 'glowColor', label: 'Glow color', default: '#120F17' },
];
