// Shared types + assembler for the per-effect settings panels on /glass-test.
// Each effect exposes a CONTROLS array (co-located `*.settings.ts`); stored
// params (EffectsSettingsContext, localStorage `kr8bit-effects`) are flat
// primitive maps keyed by control key. `paramsToProps` turns them into
// component props — array props are assembled from indexed controls, Dither's
// rgb-tuple props are converted from hex pickers. Absent keys fall back to
// the component's own defaults.

export type EffectParamValue = string | number | boolean;
export type EffectParams = Record<string, EffectParamValue>;

export interface SelectOption {
  value: string;
  label: string;
}

export type SettingControl =
  | {
      kind: 'number';
      key: string;
      label: string;
      default: number;
      min: number;
      max: number;
      step: number;
      /** Target prop name when it differs from the storage key. */
      prop?: string;
      /** Array-member index — controls sharing a prop assemble into an array. */
      index?: number;
    }
  | {
      kind: 'color';
      key: string;
      label: string;
      default: string;
      prop?: string;
      index?: number;
      /** 'rgb' converts the picked hex into a [r,g,b] 0–1 tuple prop. */
      as?: 'hex' | 'rgb';
    }
  | {
      kind: 'boolean';
      key: string;
      label: string;
      default: boolean;
      prop?: string;
    }
  | {
      kind: 'select';
      key: string;
      label: string;
      default: string;
      options: SelectOption[];
      prop?: string;
    }
  | {
      kind: 'text';
      key: string;
      label: string;
      default: string;
      prop?: string;
    };

const hexToRgb01 = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [1, 1, 1];
  return [
    parseInt(m[1] ?? 'ff', 16) / 255,
    parseInt(m[2] ?? 'ff', 16) / 255,
    parseInt(m[3] ?? 'ff', 16) / 255,
  ];
};

/**
 * Assemble stored params into component props.
 * - Scalar props are only included when the user set them (component
 *   defaults fill the rest).
 * - Array props (indexed controls) are always complete: missing members
 *   fall back to the control defaults so no holes reach the component.
 */
export function paramsToProps<P extends object>(
  controls: SettingControl[],
  params: EffectParams | undefined,
): Partial<P> {
  const props: Record<string, unknown> = {};
  const arrays = new Map<string, unknown[]>();

  for (const control of controls) {
    const prop = control.prop ?? control.key;
    const stored = params?.[control.key];

    if (control.kind === 'number' || control.kind === 'color') {
      if (control.index !== undefined) {
        let arr = arrays.get(prop);
        if (!arr) {
          arr = [];
          arrays.set(prop, arr);
        }
        const raw = stored ?? control.default;
        arr[control.index] =
          control.kind === 'color' && control.as === 'rgb' && typeof raw === 'string'
            ? hexToRgb01(raw)
            : raw;
        continue;
      }
      if (stored === undefined) continue;
      props[prop] =
        control.kind === 'color' && control.as === 'rgb' && typeof stored === 'string'
          ? hexToRgb01(stored)
          : stored;
      continue;
    }

    if (stored === undefined) continue;
    props[prop] = stored;
  }

  for (const [prop, arr] of arrays) {
    props[prop] = arr;
  }

  return props as Partial<P>;
}
