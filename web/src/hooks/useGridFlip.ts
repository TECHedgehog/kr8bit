import { useCallback, useMemo, useRef } from 'react';

// FLIP (First-Last-Invert-Play) for grid layout shifts caused by the
// advanced search sidebar toggling. The sidebar wrapper's width snaps to
// its final value in both directions (no CSS width transition — an animated
// width reflows the grid every frame and cancels out the transforms applied
// here). This hook glides the cards from their pre-toggle positions to the
// post-commit layout using transform only, so the animation runs entirely
// on the compositor.
//
// Inline styles are always cleared afterwards so @formkit/auto-animate
// (which also writes inline transform/transition on the same children for
// DOM add/remove) stays the owner outside of panel toggles.

const FLIP_DURATION_MS = 300;
const FLIP_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const CLEANUP_DELAY_MS = FLIP_DURATION_MS + 60;

export function useGridFlip(gridRef: React.RefObject<HTMLDivElement | null>) {
  const firstRectsRef = useRef<Map<HTMLElement, DOMRect> | null>(null);
  const flightElsRef = useRef<HTMLElement[]>([]);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetFlight = useCallback(() => {
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    for (const el of flightElsRef.current) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.willChange = '';
    }
    flightElsRef.current = [];
  }, []);

  // Record pre-toggle positions. Called synchronously before the state
  // update that triggers the layout change. No-op when reduced motion is
  // preferred or the grid is empty (play() then also no-ops).
  const capture = useCallback(() => {
    firstRectsRef.current = null;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const grid = gridRef.current;
    if (!grid || grid.children.length === 0) return;
    const rects = new Map<HTMLElement, DOMRect>();
    for (const el of grid.children) {
      // getBoundingClientRect includes any in-flight FLIP transform, so
      // rapid re-toggles chain from the current visual position.
      rects.set(el as HTMLElement, el.getBoundingClientRect());
    }
    firstRectsRef.current = rects;
  }, [gridRef]);

  // Invert + play after the new layout has committed (called from a
  // useLayoutEffect). Any previous flight is reset before measuring: its
  // transform is already baked into the captured rects, so clearing it
  // here causes no visual jump (nothing paints between the synchronous
  // steps).
  const play = useCallback(() => {
    const firstRects = firstRectsRef.current;
    firstRectsRef.current = null;
    if (!firstRects) return;
    resetFlight();
    const grid = gridRef.current;
    if (!grid) return;

    const flight: HTMLElement[] = [];
    for (const el of grid.children) {
      const first = firstRects.get(el as HTMLElement);
      if (!first) continue;
      const last = el.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (dx === 0 && dy === 0) continue;
      const htmlEl = el as HTMLElement;
      htmlEl.style.transition = 'none';
      htmlEl.style.transform = `translate(${dx}px, ${dy}px)`;
      flight.push(htmlEl);
    }
    if (flight.length === 0) return;

    // Commit the inverted transforms as the animation start state.
    void flight[0].offsetWidth;
    for (const el of flight) {
      el.style.willChange = 'transform';
      el.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}`;
      el.style.transform = '';
    }
    flightElsRef.current = flight;
    cleanupTimerRef.current = setTimeout(() => {
      cleanupTimerRef.current = null;
      for (const el of flightElsRef.current) {
        el.style.transition = '';
        el.style.transform = '';
        el.style.willChange = '';
      }
      flightElsRef.current = [];
    }, CLEANUP_DELAY_MS);
  }, [gridRef, resetFlight]);

  // Drop any pending capture and stop any in-flight glide.
  const cancel = useCallback(() => {
    firstRectsRef.current = null;
    resetFlight();
  }, [resetFlight]);

  // Memoized: consumers keep this object in effect deps (e.g. a cleanup
  // effect that clears the panel close timer) — an unstable identity would
  // re-run those effects every render and cancel pending work.
  return useMemo(() => ({ capture, play, cancel }), [capture, play, cancel]);
}
