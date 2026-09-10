import type { SettingControl } from './effectSettings';

// Settings panel controls for Particles — particleColors is an array prop,
// exposed as three indexed color pickers.

export const CONTROLS: SettingControl[] = [
  { kind: 'number', key: 'particleCount', label: 'Particle count', default: 200, min: 10, max: 1000, step: 10 },
  { kind: 'number', key: 'particleSpread', label: 'Particle spread', default: 10, min: 1, max: 30, step: 0.5 },
  { kind: 'number', key: 'speed', label: 'Speed', default: 0.1, min: 0, max: 1, step: 0.01 },
  { kind: 'color', key: 'particleColors0', label: 'Particle color 1', default: '#ffffff', prop: 'particleColors', index: 0 },
  { kind: 'color', key: 'particleColors1', label: 'Particle color 2', default: '#ffffff', prop: 'particleColors', index: 1 },
  { kind: 'color', key: 'particleColors2', label: 'Particle color 3', default: '#ffffff', prop: 'particleColors', index: 2 },
  { kind: 'boolean', key: 'moveParticlesOnHover', label: 'Move on hover', default: false },
  { kind: 'number', key: 'particleHoverFactor', label: 'Hover factor', default: 1, min: 0, max: 5, step: 0.1 },
  { kind: 'boolean', key: 'alphaParticles', label: 'Alpha particles', default: false },
  { kind: 'number', key: 'particleBaseSize', label: 'Base size', default: 100, min: 10, max: 300, step: 5 },
  { kind: 'number', key: 'sizeRandomness', label: 'Size randomness', default: 1, min: 0, max: 2, step: 0.05 },
  { kind: 'number', key: 'cameraDistance', label: 'Camera distance', default: 20, min: 5, max: 50, step: 1 },
  { kind: 'boolean', key: 'disableRotation', label: 'Disable rotation', default: false },
];
