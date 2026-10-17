import type {
  BooleanSettingSpec,
  IntegerSettingSpec,
  SettingSpec,
  StringSettingSpec,
} from '../settings/settings.types.js';

export const REPACK_ENABLED = 'repackCatalogEnabled';
export const REPACK_BASE_URL = 'repackCatalogFitGirlBaseUrl';
export const REPACK_INTERVAL_HOURS = 'repackCatalogIntervalHours';
export const REPACK_AUDIT_ENABLED = 'repackCatalogAuditEnabled';
export const REPACK_AUDIT_INTERVAL_HOURS = 'repackCatalogAuditIntervalHours';
const REPACK_FULL_IMPORT_COMPLETE = 'repackCatalogFullImportComplete';

export const REPACK_ENABLED_SPEC = {
  key: REPACK_ENABLED,
  kind: 'boolean',
  default: false,
  prefix: 'repackCatalog',
} satisfies BooleanSettingSpec;
export const REPACK_BASE_URL_SPEC = {
  key: REPACK_BASE_URL,
  kind: 'string',
  default: 'https://fitgirl-repacks.site/',
  constraints: { protocol: 'https:' },
} satisfies StringSettingSpec;
export const REPACK_INTERVAL_HOURS_SPEC = {
  key: REPACK_INTERVAL_HOURS,
  kind: 'integer',
  default: 24,
  constraints: { min: 1, max: 8760 },
} satisfies IntegerSettingSpec;
export const REPACK_AUDIT_ENABLED_SPEC = {
  key: REPACK_AUDIT_ENABLED,
  kind: 'boolean',
  default: false,
} satisfies BooleanSettingSpec;
export const REPACK_AUDIT_INTERVAL_HOURS_SPEC = {
  key: REPACK_AUDIT_INTERVAL_HOURS,
  kind: 'integer',
  default: 720,
  constraints: { min: 1, max: 8760 },
} satisfies IntegerSettingSpec;
export const REPACK_FULL_IMPORT_COMPLETE_SPEC = {
  key: REPACK_FULL_IMPORT_COMPLETE,
  kind: 'boolean',
  default: false,
  internal: true,
} satisfies BooleanSettingSpec;

export const REPACK_CATALOG_SETTING_SPECS: readonly SettingSpec[] = [
  REPACK_ENABLED_SPEC,
  REPACK_BASE_URL_SPEC,
  REPACK_INTERVAL_HOURS_SPEC,
  REPACK_AUDIT_ENABLED_SPEC,
  REPACK_AUDIT_INTERVAL_HOURS_SPEC,
  REPACK_FULL_IMPORT_COMPLETE_SPEC,
];

export const REPACK_CATALOG_USER_SETTING_SPECS = REPACK_CATALOG_SETTING_SPECS.filter((spec) => !spec.internal);
