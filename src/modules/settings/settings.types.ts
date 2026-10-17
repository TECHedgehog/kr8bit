export interface Setting {
  key: string;
  value: string;
}

type SettingKind = 'string' | 'boolean' | 'integer' | 'date';

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

export type StringSettingSpec = SettingSpec & { kind: 'string'; default: string };
export type BooleanSettingSpec = SettingSpec & { kind: 'boolean'; default: boolean };
export type IntegerSettingSpec = SettingSpec & { kind: 'integer'; default: number };
export type DateSettingSpec = SettingSpec & { kind: 'date'; default: string };
