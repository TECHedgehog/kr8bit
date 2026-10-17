import { describe, expect, it } from 'vitest';
import { clampLensY, getLensScale, getLensSize, getLensY } from './settings-lens-geometry';

describe('settings lens geometry', () => {
  it('clamps Y to glass bounds', () => {
    expect(clampLensY(-0.2)).toBe(0);
    expect(clampLensY(0.35)).toBe(0.35);
    expect(clampLensY(1.2)).toBe(1);
  });

  it('uses centered Y when glass has no height', () => {
    expect(getLensY(20, 10, 0)).toBe(0.5);
  });

  it('computes idle and peak sizes', () => {
    expect(getLensSize(200, 32)).toEqual({ width: 184, height: 34 });
    expect(getLensSize(200, 32, true)).toEqual({ width: 208, height: 58 });
  });

  it('returns idle and peak scale values', () => {
    expect(getLensScale()).toBe(0);
    expect(getLensScale(true)).toBe(0.05);
  });
});
