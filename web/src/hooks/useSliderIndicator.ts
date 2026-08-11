import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface IndicatorStyle {
  translate: string;
  width: string;
  opacity: number;
}

interface UseSliderIndicatorOptions {
  toggleRef: React.RefObject<HTMLDivElement | null>;
  indicatorRef: React.RefObject<HTMLDivElement | null>;
  activeSelector: string;
  dep: unknown;
}

export function useSliderIndicator({
  toggleRef,
  indicatorRef,
  activeSelector,
  dep,
}: UseSliderIndicatorOptions) {
  const isFirstRender = useRef(true);
  const [suppressTransition, setSuppressTransition] = useState(true);
  const [indicatorStyle, setIndicatorStyle] = useState<IndicatorStyle>({
    translate: '0px 0',
    width: '0px',
    opacity: 0,
  });

  useLayoutEffect(() => {
    const toggle = toggleRef.current;
    if (!toggle) return;

    const activeBtn = toggle.querySelector(activeSelector) as HTMLElement | null;
    if (!activeBtn) {
      setIndicatorStyle((s) => ({ ...s, opacity: 0 }));
      return;
    }

    let x = 0;
    let cursor: HTMLElement | null = activeBtn;
    while (cursor && cursor !== toggle) {
      x += cursor.offsetLeft;
      cursor = cursor.offsetParent as HTMLElement | null;
    }
    const w = activeBtn.offsetWidth;

    setIndicatorStyle({
      translate: `${Math.round(x)}px 0`,
      width: `${w}px`,
      opacity: 1,
    });

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const el = indicatorRef.current;
    if (el) {
      el.classList.remove('view-toggle-indicator--moving');
      void el.offsetWidth;
      el.classList.add('view-toggle-indicator--moving');
    }
  }, [dep, activeSelector, toggleRef, indicatorRef]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSuppressTransition(false));
    return () => cancelAnimationFrame(id);
  }, []);

  const onAnimationEnd = useCallback(() => {
    indicatorRef.current?.classList.remove('view-toggle-indicator--moving');
  }, [indicatorRef]);

  return { indicatorStyle, suppressTransition, onAnimationEnd };
}
