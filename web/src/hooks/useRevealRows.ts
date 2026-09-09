import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { VirtualItem } from '@tanstack/react-virtual';

// Viewport-entry reveal for virtualized grid rows. Rows mount early —
// the virtualizer's overscan keeps them in the DOM well before they are
// visible — so a mount-time animation would play out offscreen. This
// hook keeps one shared IntersectionObserver and toggles .is-visible on
// each row as it enters/leaves the viewport; the card reveal animation
// in styles.css is scoped to that class, so it fires exactly at the
// screen edge and re-fires on every re-entry.
export function useRevealRows(
  gridRef: RefObject<HTMLDivElement | null>,
  rows: VirtualItem[],
): void {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedRef = useRef<Set<Element>>(new Set());

  // One observer for all rows. Cleanup also clears the registry so a
  // StrictMode remount re-registers everything against the new observer.
  // The Set instance is never reassigned, so the captured reference is
  // safe to clear in the cleanup.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle('is-visible', entry.isIntersecting);
        }
      },
      { threshold: 0 },
    );
    observerRef.current = observer;
    const observed = observedRef.current;
    return () => {
      observer.disconnect();
      observerRef.current = null;
      observed.clear();
    };
  }, []);

  // Register rows mounted since the last run and prune detached ones —
  // the observer holds strong references, so unobserving is required
  // (virtualization churns rows constantly). Runs whenever the virtual
  // row set changes identity (range, column or item changes).
  useEffect(() => {
    const observer = observerRef.current;
    const grid = gridRef.current;
    if (!observer || !grid) return;
    const observed = observedRef.current;
    for (const row of grid.querySelectorAll('.game-grid-row')) {
      if (!observed.has(row)) {
        observed.add(row);
        observer.observe(row);
      }
    }
    for (const row of observed) {
      if (!row.isConnected) {
        observer.unobserve(row);
        observed.delete(row);
      }
    }
  }, [gridRef, rows]);
}
