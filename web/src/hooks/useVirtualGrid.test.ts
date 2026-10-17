import { describe, expect, it } from 'vitest';
import { getGridColumnCount } from './useVirtualGrid';

describe('getGridColumnCount', () => {
  it('returns no columns until container width is known', () => {
    expect(getGridColumnCount(0, 16, 160)).toBe(0);
  });

  it('keeps at least one column in a narrow container', () => {
    expect(getGridColumnCount(35, 16, 160)).toBe(1);
  });

  it('recomputes columns at responsive widths', () => {
    expect(getGridColumnCount(1280, 16, 160)).toBe(7);
    expect(getGridColumnCount(390, 16, 160)).toBe(2);
  });
});
