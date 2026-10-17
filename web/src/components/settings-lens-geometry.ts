const SETTINGS_LENS_MARGIN = 1;
const SETTINGS_LENS_WIDTH_INSET = 16;
const SETTINGS_LENS_RISE = 24;
const SETTINGS_LENS_SCALE_IDLE = 0;
const SETTINGS_LENS_SCALE_PEAK = 0.05;

export type SettingsLensSize = {
  width: number;
  height: number;
};

export function clampLensY(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getLensY(activeCenterY: number, glassTop: number, glassHeight: number): number {
  const targetY = glassHeight > 0 ? (activeCenterY - glassTop) / glassHeight : 0.5;
  return clampLensY(targetY);
}

export function getLensSize(menuWidth: number, activeHeight: number, peak = false): SettingsLensSize {
  const idleWidth = Math.max(0, menuWidth - SETTINGS_LENS_WIDTH_INSET);
  const idleHeight = activeHeight + 2 * SETTINGS_LENS_MARGIN;

  return peak
    ? { width: idleWidth + SETTINGS_LENS_RISE, height: idleHeight + SETTINGS_LENS_RISE }
    : { width: idleWidth, height: idleHeight };
}

export function getLensScale(peak = false): number {
  return peak ? SETTINGS_LENS_SCALE_PEAK : SETTINGS_LENS_SCALE_IDLE;
}
