import { useEffect, useRef } from 'react';

interface UseMarqueeOptions {
  speedPxPerSec?: number;
  minDuration?: number;
  maxDuration?: number;
}

export function useMarquee(content: string, opts: UseMarqueeOptions = {}) {
  const { speedPxPerSec = 10, minDuration = 3, maxDuration = 30 } = opts;
  const viewportRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function measure() {
      const viewport = viewportRef.current;
      const text = textRef.current;
      if (!viewport || !text) return;
      const distance = text.scrollWidth - viewport.clientWidth;
      const overflow = distance > 1;
      if (overflow) {
        viewport.classList.add('marquee-active');
        const duration = Math.max(minDuration, Math.min(maxDuration, distance / speedPxPerSec));
        viewport.style.setProperty('--marquee-distance', `${distance}px`);
        viewport.style.setProperty('--marquee-duration', `${duration}s`);
      } else {
        viewport.classList.remove('marquee-active');
        viewport.style.removeProperty('--marquee-distance');
        viewport.style.removeProperty('--marquee-duration');
      }
    }

    measure();

    let ro: ResizeObserver | null = null;
    const viewport = viewportRef.current;
    const text = textRef.current;
    if (typeof ResizeObserver !== 'undefined' && viewport && text) {
      ro = new ResizeObserver(measure);
      ro.observe(viewport);
      ro.observe(text);
    } else {
      window.addEventListener('resize', measure);
    }

    return () => {
      if (ro) {
        ro.disconnect();
      } else {
        window.removeEventListener('resize', measure);
      }
    };
  }, [content, speedPxPerSec, minDuration, maxDuration]);

  return { viewportRef, textRef };
}
