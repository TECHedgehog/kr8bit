export interface Setting {
  key: string;
  value: string;
}

type SettingKind = 'string' | 'boolean' | 'integer';

interface SettingConstraints {
  min?: number;
  max?: number;
  maxLength?: number;
  protocol?: string;
}

export interface SettingSpec {
  key: string;
  kind: SettingKind;
  default: string | boolean | number;
  constraints?: SettingConstraints;
  internal?: boolean;
  prefix?: string;
  validate?: (value: string) => void;
}
