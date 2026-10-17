import type { SettingKind, SettingSpec } from './settings.types.js';

interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}
type SettingValue<Kind extends SettingKind> = Kind extends 'boolean'
  ? boolean
  : Kind extends 'integer'
    ? number
    : Kind extends 'date'
      ? Date
      : string;

const ISO_8601_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

export function isIso8601Date(value: string): boolean {
  if (!ISO_8601_DATE.test(value)) return false;
  const datePart = value.slice(0, 10);
  const date = new Date(`${datePart}T00:00:00.000Z`);
  return Number.isFinite(Date.parse(value)) && date.toISOString().slice(0, 10) === datePart;
}

function hasValidStringConstraints(spec: SettingSpec, value: string): boolean {
  if (spec.constraints?.maxLength !== undefined && value.length > spec.constraints.maxLength) return false;
  if (spec.constraints?.protocol) {
    try {
      const url = new URL(value);
      if (url.protocol !== spec.constraints.protocol || !url.hostname) return false;
    } catch {
      return false;
    }
  }
  try {
    spec.validate?.(value);
    return true;
  } catch {
    return false;
  }
}

function hasValidIntegerConstraints(spec: SettingSpec, value: number): boolean {
  const min = spec.constraints?.min;
  const max = spec.constraints?.max;
  return Number.isInteger(value)
    && (min === undefined || value >= min)
    && (max === undefined || value <= max);
}

export function createSettingsReader(repository: SettingsRepository) {
  async function storedValue(spec: SettingSpec): Promise<string | null> {
    return repository.get(spec.key);
  }

  return {
    async string(spec: SettingSpec): Promise<string> {
      const value = await storedValue(spec);
      return spec.kind === 'string' && value !== null && hasValidStringConstraints(spec, value)
        ? value
        : spec.default as string;
    },

    async boolean(spec: SettingSpec): Promise<boolean> {
      const value = await storedValue(spec);
      if (spec.kind !== 'boolean') return spec.default as boolean;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return spec.default as boolean;
    },

    async integer(spec: SettingSpec): Promise<number> {
      const value = await storedValue(spec);
      if (spec.kind !== 'integer' || value === null || !/^-?\d+$/.test(value)) {
        return spec.default as number;
      }
      const parsed = Number(value);
      return hasValidIntegerConstraints(spec, parsed) ? parsed : spec.default as number;
    },

    async date(spec: SettingSpec): Promise<Date | null> {
      const value = await storedValue(spec);
      if (spec.kind === 'date' && value !== null && isIso8601Date(value)) return new Date(value);
      const fallback = spec.kind === 'date' && typeof spec.default === 'string' ? spec.default : '';
      return isIso8601Date(fallback) ? new Date(fallback) : null;
    },

    async write<Kind extends SettingKind>(spec: SettingSpec & { kind: Kind }, value: SettingValue<Kind>): Promise<unknown> {
      const serialized = value instanceof Date ? value.toISOString() : String(value);
      return repository.set(spec.key, serialized);
    },
  };
}
