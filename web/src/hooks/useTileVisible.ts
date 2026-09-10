import { useEffect, useRef, type RefObject } from 'react';

export function useTileVisible<T extends HTMLElement>(ref: RefObject<T | null>): RefObject<boolean> {
  const visibleRef = useRef(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return visibleRef;
}
