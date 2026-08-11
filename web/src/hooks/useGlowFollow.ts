import { useEffect } from 'react';

export function useGlowFollow(ref: React.RefObject<HTMLElement | null>, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const coarse = matchMedia('(pointer: coarse)').matches;
    if (coarse) return;

    let raf = 0;
    let cx = 0;
    let cy = 0;

    const apply = () => {
      raf = 0;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = cx - rect.left;
      const py = cy - rect.top;
      el.style.setProperty('--glow-x', `${px.toFixed(1)}px`);
      el.style.setProperty('--glow-y', `${py.toFixed(1)}px`);
    };

    const onMove = (e: PointerEvent) => {
      cx = e.clientX;
      cy = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
      el.style.setProperty('--glow-x', '');
      el.style.setProperty('--glow-y', '');
    };
  }, [ref, enabled]);
}
