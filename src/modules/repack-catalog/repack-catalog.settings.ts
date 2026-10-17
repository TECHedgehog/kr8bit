import type { SettingSpec } from '../settings/settings.types.js';

export const REPACK_ENABLED = 'repackCatalogEnabled';
export const REPACK_BASE_URL = 'repackCatalogFitGirlBaseUrl';
export const REPACK_INTERVAL_HOURS = 'repackCatalogIntervalHours';
export const REPACK_AUDIT_ENABLED = 'repackCatalogAuditEnabled';
export const REPACK_AUDIT_INTERVAL_HOURS = 'repackCatalogAuditIntervalHours';
export const REPACK_FULL_IMPORT_COMPLETE = 'repackCatalogFullImportComplete';

export const REPACK_CATALOG_SETTING_SPECS = [
  { key: REPACK_ENABLED, kind: 'boolean', default: false, prefix: 'repackCatalog' },
  { key: REPACK_BASE_URL, kind: 'string', default: 'https://fitgirl-repacks.site/', constraints: { protocol: 'https:' } },
  { key: REPACK_INTERVAL_HOURS, kind: 'integer', default: 24, constraints: { min: 1, max: 8760 } },
  { key: REPACK_AUDIT_ENABLED, kind: 'boolean', default: false },
  { key: REPACK_AUDIT_INTERVAL_HOURS, kind: 'integer', default: 720, constraints: { min: 1, max: 8760 } },
  { key: REPACK_FULL_IMPORT_COMPLETE, kind: 'boolean', default: false, internal: true },
] satisfies readonly SettingSpec[];

export const REPACK_CATALOG_USER_SETTING_SPECS = REPACK_CATALOG_SETTING_SPECS.filter((spec) => !spec.internal);
