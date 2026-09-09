import { useEffect, useRef, type RefObject } from 'react';

/**
 * Tracks whether the element is intersecting the viewport.
 * Returns a ref (no re-renders) so animation loops can skip
 * canvas/WebGL work while their tile is offscreen.
 *
 * Used by the effects playground on /glass-test, where several
 * animated components render simultaneously.
 */
export function useTileVisible<T extends HTMLElement>(ref: RefObject<T | null>): RefObject<boolean> {
  const visibleRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [ref]);

  return visibleRef;
}
