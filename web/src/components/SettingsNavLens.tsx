import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Glass, animateGlassValue, cubicBezier, glassValue } from '@samasante/liquid-glass';
import { GLASS_FILTER_RESOLUTION, useGlassTune } from '../context/GlassTuneContext';
import { useTheme } from '../context/ThemeContext';
import type { SettingsCategory } from '../settings-categories';
import { getLensScale, getLensSize, getLensY } from './settings-lens-geometry';

const SETTINGS_LENS_RADIUS = 24;
const SETTINGS_LENS_DEPTH = 0.7;
const SETTINGS_MOVE_ANIMATION = { duration: 0.4, ease: cubicBezier(0.42, 0, 0.58, 1) };
const SETTINGS_RAISE_ANIMATION = { duration: 0.25, ease: cubicBezier(0.42, 0, 0.58, 1) };
const SETTINGS_LOWER_ANIMATION = { duration: 0.2, ease: cubicBezier(0.33, 1, 0.68, 1) };

type SettingsNavLensProps = {
  menuRef: RefObject<HTMLElement>;
  active: SettingsCategory;
  children: ReactNode;
};

export function SettingsNavLens({ menuRef, active, children }: SettingsNavLensProps): JSX.Element {
  const { pill } = useGlassTune();
  const { theme } = useTheme();
  const { lensY, lensW, lensH, lensScale, isGeometryReady } = useSettingsNavLens(menuRef, active);
  const behind = theme === 'dark' ? '#1a1d24' : '#e8ebf0';

  return (
    <div className="settings-menu-glass" aria-hidden="true">
      {isGeometryReady && (
        <Glass
          optics={pill.effectiveOptics}
          width={lensW}
          height={lensH}
          radius={SETTINGS_LENS_RADIUS}
          center={{ x: 0.5, y: lensY }}
          scale={lensScale}
          depth={SETTINGS_LENS_DEPTH}
          refract={children}
          behind={behind}
          filterResolution={GLASS_FILTER_RESOLUTION}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}

function useSettingsNavLens(menuRef: RefObject<HTMLElement>, active: SettingsCategory) {
  const lastActiveRef = useRef(active);
  const transitRef = useRef(0);
  const [isLensMoving, setIsLensMoving] = useState(false);
  const lensY = useMemo(() => glassValue(0.5), []);
  const lensW = useMemo(() => glassValue(160), []);
  const lensH = useMemo(() => glassValue(160), []);
  const lensScale = useMemo(() => glassValue(getLensScale()), []);
  const [isGeometryReady, setIsGeometryReady] = useState(false);

  // The ancestor nav ref is not committed during this child's layout effect.
  useEffect(() => {
    if (isGeometryReady) return;
    const menu = menuRef.current;
    if (!menu) return;
    const glass = menu.querySelector('.settings-menu-glass') as HTMLElement | null;
    const activeItem = menu.querySelector('.settings-menu-content .settings-menu-item.is-active') as HTMLElement | null;
    if (!glass || !activeItem) return;

    const glassRect = glass.getBoundingClientRect();
    const activeRect = activeItem.getBoundingClientRect();
    const idleSize = getLensSize(menu.offsetWidth, activeRect.height);
    lensY.set(getLensY(activeRect.top + activeRect.height / 2, glassRect.top, glassRect.height));
    lensW.set(idleSize.width);
    lensH.set(idleSize.height);
    lensScale.set(getLensScale());
    setIsGeometryReady(true);
  }, [active, isGeometryReady, lensH, lensScale, lensW, lensY, menuRef]);

  useLayoutEffect(() => {
    if (!isGeometryReady) return;
    const menu = menuRef.current;
    if (!menu) return;
    const glass = menu.querySelector('.settings-menu-glass') as HTMLElement | null;
    const activeItem = menu.querySelector('.settings-menu-content .settings-menu-item.is-active') as HTMLElement | null;
    if (!glass || !activeItem) return;

    const glassRect = glass.getBoundingClientRect();
    const activeRect = activeItem.getBoundingClientRect();
    const targetY = getLensY(activeRect.top + activeRect.height / 2, glassRect.top, glassRect.height);
    const idleSize = getLensSize(menu.offsetWidth, activeRect.height);
    const peakSize = getLensSize(menu.offsetWidth, activeRect.height, true);
    const targetChanged = lastActiveRef.current !== active;
    lastActiveRef.current = active;

    if (!targetChanged) {
      lensY.set(targetY);
      lensW.set(idleSize.width);
      lensH.set(idleSize.height);
      lensScale.set(getLensScale());
      return;
    }

    const transit = ++transitRef.current;
    setIsLensMoving(true);
    animateGlassValue(lensY, targetY, SETTINGS_MOVE_ANIMATION);
    animateGlassValue(lensW, peakSize.width, {
      ...SETTINGS_RAISE_ANIMATION,
      onComplete: () => {
        if (transitRef.current !== transit) return;
        animateGlassValue(lensW, idleSize.width, {
          ...SETTINGS_LOWER_ANIMATION,
          onComplete: () => {
            if (transitRef.current === transit) setIsLensMoving(false);
          },
        });
        animateGlassValue(lensH, idleSize.height, SETTINGS_LOWER_ANIMATION);
        animateGlassValue(lensScale, getLensScale(), SETTINGS_LOWER_ANIMATION);
      },
    });
    animateGlassValue(lensH, peakSize.height, SETTINGS_RAISE_ANIMATION);
    animateGlassValue(lensScale, getLensScale(true), SETTINGS_RAISE_ANIMATION);
  }, [active, isGeometryReady, lensH, lensScale, lensW, lensY, menuRef]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    menu.classList.toggle('is-moving', isLensMoving);
    return () => menu.classList.remove('is-moving');
  }, [isGeometryReady, isLensMoving, menuRef]);

  useLayoutEffect(() => {
    if (isLensMoving) return;
    const menu = menuRef.current;
    const activeItem = menu?.querySelector('.settings-menu-content .settings-menu-item.is-active') as HTMLElement | null;
    const glass = menu?.querySelector('.settings-menu-glass') as HTMLElement | null;
    if (!menu || !activeItem || !glass) return;
    const glassRect = glass.getBoundingClientRect();
    const activeRect = activeItem.getBoundingClientRect();
    const idleSize = getLensSize(menu.offsetWidth, activeRect.height);
    lensW.set(idleSize.width);
    lensH.set(idleSize.height);
    lensY.set(getLensY(activeRect.top + activeRect.height / 2, glassRect.top, glassRect.height));
  }, [isGeometryReady, isLensMoving, lensH, lensW, lensY, menuRef]);

  return { lensY, lensW, lensH, lensScale, isGeometryReady };
}
