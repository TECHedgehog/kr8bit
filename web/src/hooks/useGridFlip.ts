import { useCallback, useMemo, useRef } from 'react';
import { prefersReducedMotion, usePerformanceSettings } from '../context/PerformanceSettingsContext';

// FLIP (First-Last-Invert-Play) for grid layout shifts caused by the
// advanced search sidebar and settings panel toggling. The layout snaps
// to its final state in both directions (no animated width/height — that
// would reflow the grid every frame and cancel out the transforms applied
// here). This hook glides the cards from their pre-toggle positions to
// the post-commit layout using transform only, so the animation runs
// entirely on the compositor.
//
// Cards are matched across the toggle by data-game-id, not DOM identity:
// virtualized rows re-slice whenever the grid width changes, so a card's
// DOM node is usually replaced even though the game stays on screen.
// While a flight is in play the grid carries [data-flip-active] so the
// cards' mount animation is suppressed (see styles.css) — remounting
// cards must glide, not fade.

const FLIP_DURATION_MS = 300;
const FLIP_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
// Longest possible suppressed reveal: cards stagger up to 8 columns ×
// 40ms delay plus the 250ms duration (see .game-grid-row.is-visible in
// styles.css). The [data-flip-active] suppression must outlast any
// animation it collapsed — restoring the original timing while one is
// still running would resume a partial fade-in after the glide.
const REVEAL_TAIL_MS = 8 * 40 + 250;
const CLEANUP_DELAY_MS = FLIP_DURATION_MS + REVEAL_TAIL_MS + 60;

export function useGridFlip(gridRef: React.RefObject<HTMLDivElement | null>) {
  const { motion, gridAnimations } = usePerformanceSettings();
  const firstRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const flightElsRef = useRef<HTMLElement[]>([]);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetFlight = useCallback(() => {
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    const grid = gridRef.current;
    if (grid) delete grid.dataset.flipActive;
    for (const el of flightElsRef.current) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.willChange = '';
    }
    flightElsRef.current = [];
  }, [gridRef]);

  // Record pre-toggle positions, keyed by data-game-id. Called
  // synchronously before the state update that triggers the layout
  // change. No-op when reduced motion is preferred or no cards are
  // mounted (play() then also no-ops).
  const capture = useCallback(() => {
    firstRectsRef.current = null;
    if (!gridAnimations || prefersReducedMotion(motion)) return;
    const grid = gridRef.current;
    if (!grid) return;
    const rects = new Map<string, DOMRect>();
    for (const el of grid.querySelectorAll<HTMLElement>('.game-card')) {
      const id = el.dataset.gameId;
      if (!id) continue;
      // getBoundingClientRect includes any in-flight FLIP transform, so
      // rapid re-toggles chain from the current visual position.
      rects.set(id, el.getBoundingClientRect());
    }
    if (rects.size === 0) return;
    firstRectsRef.current = rects;
  }, [gridRef, gridAnimations, motion]);

  // Invert + play after the new layout has committed (called from a
  // useLayoutEffect). Any previous flight is reset before measuring: its
  // transform is already baked into the captured rects, so clearing it
  // here causes no visual jump (nothing paints between the synchronous
  // steps). Cards absent from the capture (freshly mounted) are skipped —
  // they simply appear in place.
  const play = useCallback(() => {
    const firstRects = firstRectsRef.current;
    firstRectsRef.current = null;
    if (!firstRects) return;
    resetFlight();
    const grid = gridRef.current;
    if (!grid) return;

    const flight: HTMLElement[] = [];
    for (const el of grid.querySelectorAll<HTMLElement>('.game-card')) {
      const first = el.dataset.gameId ? firstRects.get(el.dataset.gameId) : undefined;
      if (!first) continue;
      const last = el.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (dx === 0 && dy === 0) continue;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      flight.push(el);
    }
    if (flight.length === 0) return;

    // Suppress the card mount animation for the duration of the flight:
    // remounted cards must glide from their captured positions, not fade.
    grid.dataset.flipActive = 'true';

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
      const grid = gridRef.current;
      if (grid) delete grid.dataset.flipActive;
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
