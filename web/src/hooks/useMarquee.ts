import { useEffect, useRef } from 'react';

interface UseMarqueeOptions {
  speedPxPerSec?: number;
  minDuration?: number;
  maxDuration?: number;
}

/* marquee-scroll phases: rest 0-15%, move 15-60%, rest 60-75%, move 75-90%,
   rest 90-100%. Edge fades follow the text: an edge is clear only while the
   text rests at that edge, both fade while moving. Classes toggle at phase
   boundaries; CSS transitions the alpha over --marquee-fade-time. */
const EDGE_PHASES = [
  { at: 0.15, cls: 'marquee-fade-l', on: true },
  { at: 0.6, cls: 'marquee-fade-r', on: false },
  { at: 0.75, cls: 'marquee-fade-r', on: true },
  { at: 0.9, cls: 'marquee-fade-l', on: false },
] as const;

const EDGE_CLASSES = ['marquee-fade-l', 'marquee-fade-r'] as const;

export function useMarquee(content: string, opts: UseMarqueeOptions = {}) {
  const { speedPxPerSec = 10, minDuration = 3, maxDuration = 30 } = opts;
  const viewportRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    const textEl = textRef.current;
    if (!viewportEl || !textEl) return;
    const viewport: HTMLDivElement = viewportEl;
    const text: HTMLSpanElement = textEl;

    let edgeTimers: number[] = [];

    function clearEdgeTimers() {
      edgeTimers.forEach((t) => window.clearTimeout(t));
      edgeTimers = [];
    }

    function setEdgeClass(cls: string, on: boolean) {
      viewport.classList.toggle(cls, on);
    }

    function clearEdges() {
      EDGE_CLASSES.forEach((cls) => viewport.classList.remove(cls));
    }

    function scheduleEdgePhases() {
      clearEdgeTimers();
      const duration = parseFloat(viewport.style.getPropertyValue('--marquee-duration'));
      if (!Number.isFinite(duration) || duration <= 0) return;
      for (const phase of EDGE_PHASES) {
        edgeTimers.push(
          window.setTimeout(() => setEdgeClass(phase.cls, phase.on), phase.at * duration * 1000),
        );
      }
    }

    function handleAnimationEvent(e: AnimationEvent) {
      if (e.animationName !== 'marquee-scroll') return;
      if (e.type === 'animationcancel') {
        // Hover gate closed or marquee deactivated mid-cycle: both edges clear.
        clearEdgeTimers();
        clearEdges();
      } else {
        // animationstart / animationiteration: cycle begins at the left rest
        // phase — left edge clear, right edge faded (text overflows right).
        setEdgeClass('marquee-fade-l', false);
        setEdgeClass('marquee-fade-r', true);
        scheduleEdgePhases();
      }
    }

    text.addEventListener('animationstart', handleAnimationEvent);
    text.addEventListener('animationiteration', handleAnimationEvent);
    text.addEventListener('animationcancel', handleAnimationEvent);

    function measure() {
      const distance = text.scrollWidth - viewport.clientWidth;
      const overflow = distance > 1;
      if (overflow) {
        viewport.classList.add('marquee-active');
        const duration = Math.max(minDuration, Math.min(maxDuration, distance / speedPxPerSec));
        viewport.style.setProperty('--marquee-distance', `${distance}px`);
        viewport.style.setProperty('--marquee-duration', `${duration}s`);
        viewport.style.setProperty('--marquee-fade-time', `${Math.max(0.15, duration * 0.05)}s`);
      } else {
        viewport.classList.remove('marquee-active');
        clearEdges();
        viewport.style.removeProperty('--marquee-distance');
        viewport.style.removeProperty('--marquee-duration');
        viewport.style.removeProperty('--marquee-fade-time');
      }
    }

    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(viewport);
      ro.observe(text);
    } else {
      window.addEventListener('resize', measure);
    }

    return () => {
      text.removeEventListener('animationstart', handleAnimationEvent);
      text.removeEventListener('animationiteration', handleAnimationEvent);
      text.removeEventListener('animationcancel', handleAnimationEvent);
      clearEdgeTimers();
      if (ro) {
        ro.disconnect();
      } else {
        window.removeEventListener('resize', measure);
      }
    };
  }, [content, speedPxPerSec, minDuration, maxDuration]);

  return { viewportRef, textRef };
}
