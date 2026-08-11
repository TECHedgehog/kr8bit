import { useEffect } from 'react';

const GROW_MS = 250;

export function useTiltGlow(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const noMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    if (noMotion || coarse) return;

    const style = getComputedStyle(el);
    const maxTilt = parseFloat(style.getPropertyValue('--tilt-max')) || 8;
    const settleMs = parseFloat(style.getPropertyValue('--tilt-settle-ms')) || 400;
    const activeScale = parseFloat(style.getPropertyValue('--tilt-active-scale')) || 1.04;
    const pillShadowMax = parseFloat(style.getPropertyValue('--pill-shadow-max')) || 10;

    el.style.setProperty('--tilt-active-scale', '1');
    el.style.setProperty('--glow-on', '0');
    el.style.setProperty('--pill-shadow-ox', '0px');
    el.style.setProperty('--pill-shadow-oy', '0px');
    el.style.setProperty('--pill-shadow-elong', '0');

    let trackRaf = 0;
    let growRaf = 0;
    let settleRaf = 0;
    let active = false;
    let cx = 0;
    let cy = 0;

    const apply = () => {
      trackRaf = 0;
      if (!active || !el) return;
      const rect = el.getBoundingClientRect();
      const px = cx - rect.left;
      const py = cy - rect.top;
      const nx = (px / rect.width) * 2 - 1;
      const ny = (py / rect.height) * 2 - 1;
      const rx = -ny * maxTilt;
      const ry = nx * maxTilt;

      const glowOx = (ry / maxTilt) * 50;
      const glowOy = (rx / maxTilt) * 50;

      el.style.setProperty('--tilt-rx', `${rx.toFixed(2)}deg`);
      el.style.setProperty('--tilt-ry', `${ry.toFixed(2)}deg`);
      el.style.setProperty('--glow-x', `${px.toFixed(1)}px`);
      el.style.setProperty('--glow-y', `${py.toFixed(1)}px`);
      el.style.setProperty('--glow-ox', `${glowOx.toFixed(1)}%`);
      el.style.setProperty('--glow-oy', `${glowOy.toFixed(1)}%`);

      const pillShadowOx = (ry / maxTilt) * pillShadowMax;
      const pillShadowOy = (rx / maxTilt) * pillShadowMax;
      const pillShadowElong = (Math.abs(rx) + Math.abs(ry)) / (2 * maxTilt) * 0.25;

      el.style.setProperty('--pill-shadow-ox', `${pillShadowOx.toFixed(1)}px`);
      el.style.setProperty('--pill-shadow-oy', `${pillShadowOy.toFixed(1)}px`);
      el.style.setProperty('--pill-shadow-elong', `${pillShadowElong.toFixed(3)}`);
    };

    const startGrow = () => {
      if (settleRaf) {
        cancelAnimationFrame(settleRaf);
        settleRaf = 0;
      }
      el.style.willChange = 'transform';

      const startScale = parseFloat(el.style.getPropertyValue('--tilt-active-scale')) || 1;
      const startGlow = parseFloat(el.style.getPropertyValue('--glow-on')) || 0;
      const startTime = performance.now();

      const tick = (now: number) => {
        const p = Math.min((now - startTime) / GROW_MS, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        const scale = startScale + (activeScale - startScale) * ease;
        const glow = startGlow + (1 - startGlow) * ease;

        el.style.setProperty('--tilt-active-scale', `${scale.toFixed(3)}`);
        el.style.setProperty('--glow-on', `${glow.toFixed(2)}`);

        if (active && p < 1) {
          growRaf = requestAnimationFrame(tick);
        } else {
          growRaf = 0;
        }
      };

      growRaf = requestAnimationFrame(tick);
    };

    const startSettle = () => {
      if (growRaf) {
        cancelAnimationFrame(growRaf);
        growRaf = 0;
      }
      if (trackRaf) {
        cancelAnimationFrame(trackRaf);
        trackRaf = 0;
      }

      const startRx = parseFloat(el.style.getPropertyValue('--tilt-rx')) || 0;
      const startRy = parseFloat(el.style.getPropertyValue('--tilt-ry')) || 0;
      const startScale = parseFloat(el.style.getPropertyValue('--tilt-active-scale')) || activeScale;
      const startGlow = parseFloat(el.style.getPropertyValue('--glow-on')) || 1;
      const startShadowOx = parseFloat(el.style.getPropertyValue('--pill-shadow-ox')) || 0;
      const startShadowOy = parseFloat(el.style.getPropertyValue('--pill-shadow-oy')) || 0;
      const startShadowElong = parseFloat(el.style.getPropertyValue('--pill-shadow-elong')) || 0;
      const startTime = performance.now();

      const tick = (now: number) => {
        const p = Math.min((now - startTime) / settleMs, 1);
        const ease = 1 - Math.pow(1 - p, 3);

        const rx = startRx * (1 - ease);
        const ry = startRy * (1 - ease);
        const scale = 1 + (startScale - 1) * (1 - ease);
        const glow = startGlow * (1 - ease);
        const shadowOx = startShadowOx * (1 - ease);
        const shadowOy = startShadowOy * (1 - ease);
        const shadowElong = startShadowElong * (1 - ease);

        el.style.setProperty('--tilt-rx', `${rx.toFixed(2)}deg`);
        el.style.setProperty('--tilt-ry', `${ry.toFixed(2)}deg`);
        el.style.setProperty('--tilt-active-scale', `${scale.toFixed(3)}`);
        el.style.setProperty('--glow-on', `${glow.toFixed(2)}`);
        el.style.setProperty('--pill-shadow-ox', `${shadowOx.toFixed(1)}px`);
        el.style.setProperty('--pill-shadow-oy', `${shadowOy.toFixed(1)}px`);
        el.style.setProperty('--pill-shadow-elong', `${shadowElong.toFixed(3)}`);

        if (p < 1) {
          settleRaf = requestAnimationFrame(tick);
        } else {
          settleRaf = 0;
          el.style.setProperty('--glow-x', '-9999px');
          el.style.setProperty('--glow-y', '-9999px');
          el.style.setProperty('--glow-ox', '0%');
          el.style.setProperty('--glow-oy', '0%');
          el.style.setProperty('--pill-shadow-ox', '0px');
          el.style.setProperty('--pill-shadow-oy', '0px');
          el.style.setProperty('--pill-shadow-elong', '0');
          el.style.willChange = '';
        }
      };

      settleRaf = requestAnimationFrame(tick);
    };

    const onEnter = (e: PointerEvent) => {
      active = true;
      cx = e.clientX;
      cy = e.clientY;
      startGrow();
      if (!trackRaf) trackRaf = requestAnimationFrame(apply);
    };

    const onMove = (e: PointerEvent) => {
      if (!active) return;
      cx = e.clientX;
      cy = e.clientY;
      if (!trackRaf) trackRaf = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      active = false;
      startSettle();
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    return () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (trackRaf) cancelAnimationFrame(trackRaf);
      if (growRaf) cancelAnimationFrame(growRaf);
      if (settleRaf) cancelAnimationFrame(settleRaf);
      el.style.setProperty('--tilt-rx', '');
      el.style.setProperty('--tilt-ry', '');
      el.style.setProperty('--glow-x', '');
      el.style.setProperty('--glow-y', '');
      el.style.setProperty('--glow-ox', '');
      el.style.setProperty('--glow-oy', '');
      el.style.setProperty('--tilt-active-scale', '');
      el.style.setProperty('--glow-on', '');
      el.style.setProperty('--pill-shadow-ox', '');
      el.style.setProperty('--pill-shadow-oy', '');
      el.style.setProperty('--pill-shadow-elong', '');
      el.style.willChange = '';
    };
  }, [ref]);
}
