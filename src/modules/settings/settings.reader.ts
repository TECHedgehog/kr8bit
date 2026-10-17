import type {
  BooleanSettingSpec,
  DateSettingSpec,
  IntegerSettingSpec,
  SettingSpec,
  StringSettingSpec,
} from './settings.types.js';

interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}
export interface SettingsReader {
  string(spec: StringSettingSpec): Promise<string>;
  boolean(spec: BooleanSettingSpec): Promise<boolean>;
  integer(spec: IntegerSettingSpec): Promise<number>;
  date(spec: DateSettingSpec): Promise<Date | null>;
  write(spec: StringSettingSpec, value: string): Promise<unknown>;
  write(spec: BooleanSettingSpec, value: boolean): Promise<unknown>;
  write(spec: IntegerSettingSpec, value: number): Promise<unknown>;
  write(spec: DateSettingSpec, value: Date): Promise<unknown>;
}

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

export function createSettingsReader(repository: SettingsRepository): SettingsReader {
  async function storedValue(spec: SettingSpec): Promise<string | null> {
    return repository.get(spec.key);
  }

  async function write(spec: SettingSpec, value: string | boolean | number | Date): Promise<unknown> {
    const serialized = value instanceof Date ? value.toISOString() : String(value);
    return repository.set(spec.key, serialized);
  }

  return {
    async string(spec: StringSettingSpec): Promise<string> {
      const value = await storedValue(spec);
      return value !== null && hasValidStringConstraints(spec, value)
        ? value
        : spec.default;
    },

    async boolean(spec: BooleanSettingSpec): Promise<boolean> {
      const value = await storedValue(spec);
      if (value === 'true') return true;
      if (value === 'false') return false;
      return spec.default;
    },

    async integer(spec: IntegerSettingSpec): Promise<number> {
      const value = await storedValue(spec);
      if (value === null || !/^-?\d+$/.test(value)) {
        return spec.default;
      }
      const parsed = Number(value);
      return hasValidIntegerConstraints(spec, parsed) ? parsed : spec.default;
    },

    async date(spec: DateSettingSpec): Promise<Date | null> {
      const value = await storedValue(spec);
      if (value !== null && isIso8601Date(value)) return new Date(value);
      return isIso8601Date(spec.default) ? new Date(spec.default) : null;
    },

    write,
  };
}
