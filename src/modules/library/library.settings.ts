import type { SettingSpec } from '../settings/settings.types.js';

export const LIBRARY_MANUALLY_CLEARED_SETTING = 'libraryManuallyCleared';
export const LIBRARY_MANUALLY_CLEARED_SETTING_SPEC: SettingSpec = {
  key: LIBRARY_MANUALLY_CLEARED_SETTING,
  kind: 'boolean',
  default: false,
  internal: true,
};
