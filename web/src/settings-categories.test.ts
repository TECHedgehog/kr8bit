import { describe, expect, it } from 'vitest';
import { isSettingsCategory, SETTINGS_CATEGORIES } from './settings-categories';

describe('isSettingsCategory', () => {
  it('accepts each wired category', () => {
    for (const category of SETTINGS_CATEGORIES) {
      expect(isSettingsCategory(category)).toBe(true);
    }
  });

  it('rejects unknown and empty values', () => {
    expect(isSettingsCategory('providers')).toBe(false);
    expect(isSettingsCategory('')).toBe(false);
    expect(isSettingsCategory(null)).toBe(false);
    expect(isSettingsCategory(undefined)).toBe(false);
  });
});
