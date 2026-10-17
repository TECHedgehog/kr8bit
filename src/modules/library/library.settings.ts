import type { BooleanSettingSpec } from '../settings/settings.types.js';

export const LIBRARY_MANUALLY_CLEARED_SETTING_SPEC = {
  key: 'libraryManuallyCleared',
  kind: 'boolean',
  default: false,
  internal: true,
} satisfies BooleanSettingSpec;
