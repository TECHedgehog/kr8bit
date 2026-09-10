import type { SettingControl } from './effectSettings';

// Settings panel controls for BlobCursor — sizes/innerSizes/opacities are
// array props, exposed as three indexed sliders each. innerColor/shadowColor
// default to rgba() strings upstream; the hex picker loses the alpha channel
// once tweaked (untouched params keep the exact upstream default).

const EASES = [
  { value: 'power1.out', label: 'Power 1 out' },
  { value: 'power2.out', label: 'Power 2 out' },
  { value: 'power3.out', label: 'Power 3 out' },
  { value: 'power4.out', label: 'Power 4 out' },
  { value: 'sine.out', label: 'Sine out' },
  { value: 'expo.out', label: 'Expo out' },
  { value: 'back.out', label: 'Back out' },
  { value: 'elastic.out', label: 'Elastic out' },
];

export const CONTROLS: SettingControl[] = [
  {
    kind: 'select',
    key: 'blobType',
    label: 'Blob type',
    default: 'circle',
    options: [
      { value: 'circle', label: 'Circle' },
      { value: 'square', label: 'Square' },
    ],
  },
  { kind: 'color', key: 'fillColor', label: 'Fill color', default: '#5227FF' },
  { kind: 'number', key: 'trailCount', label: 'Trail count', default: 3, min: 1, max: 6, step: 1 },
  { kind: 'number', key: 'sizes0', label: 'Size 1', default: 60, min: 10, max: 300, step: 5, prop: 'sizes', index: 0 },
  { kind: 'number', key: 'sizes1', label: 'Size 2', default: 125, min: 10, max: 300, step: 5, prop: 'sizes', index: 1 },
  { kind: 'number', key: 'sizes2', label: 'Size 3', default: 75, min: 10, max: 300, step: 5, prop: 'sizes', index: 2 },
  { kind: 'number', key: 'innerSizes0', label: 'Inner size 1', default: 20, min: 5, max: 100, step: 5, prop: 'innerSizes', index: 0 },
  { kind: 'number', key: 'innerSizes1', label: 'Inner size 2', default: 35, min: 5, max: 100, step: 5, prop: 'innerSizes', index: 1 },
  { kind: 'number', key: 'innerSizes2', label: 'Inner size 3', default: 25, min: 5, max: 100, step: 5, prop: 'innerSizes', index: 2 },
  { kind: 'color', key: 'innerColor', label: 'Inner color', default: '#ffffff' },
  { kind: 'number', key: 'opacities0', label: 'Opacity 1', default: 0.6, min: 0, max: 1, step: 0.05, prop: 'opacities', index: 0 },
  { kind: 'number', key: 'opacities1', label: 'Opacity 2', default: 0.6, min: 0, max: 1, step: 0.05, prop: 'opacities', index: 1 },
  { kind: 'number', key: 'opacities2', label: 'Opacity 3', default: 0.6, min: 0, max: 1, step: 0.05, prop: 'opacities', index: 2 },
  { kind: 'color', key: 'shadowColor', label: 'Shadow color', default: '#000000' },
  { kind: 'number', key: 'shadowBlur', label: 'Shadow blur', default: 5, min: 0, max: 50, step: 1 },
  { kind: 'number', key: 'shadowOffsetX', label: 'Shadow offset X', default: 10, min: -50, max: 50, step: 1 },
  { kind: 'number', key: 'shadowOffsetY', label: 'Shadow offset Y', default: 10, min: -50, max: 50, step: 1 },
  { kind: 'number', key: 'filterStdDeviation', label: 'Gooey blur', default: 30, min: 0, max: 80, step: 1 },
  { kind: 'boolean', key: 'useFilter', label: 'Gooey filter', default: true },
  { kind: 'number', key: 'fastDuration', label: 'Lead duration (s)', default: 0.1, min: 0.01, max: 1, step: 0.01 },
  { kind: 'number', key: 'slowDuration', label: 'Trail duration (s)', default: 0.5, min: 0.05, max: 2, step: 0.05 },
  { kind: 'select', key: 'fastEase', label: 'Lead ease', default: 'power3.out', options: EASES },
  { kind: 'select', key: 'slowEase', label: 'Trail ease', default: 'power1.out', options: EASES },
];
