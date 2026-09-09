import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWindowVirtualizer, type VirtualItem } from '@tanstack/react-virtual';

// Fallbacks matching the --space-6 / --space-4 gap values on .game-grid
// in styles.css; only used when the computed gap fails to parse.
const FALLBACK_ROW_GAP = 24;
const FALLBACK_COL_GAP = 16;

// Card cover aspect ratio (2:3) plus 1px top/bottom borders — used only
// for the pre-measurement row estimate; the virtualizer measures real
// rows (card height + inter-row padding) once they mount.
const CARD_ASPECT = 1.5;
const CARD_BORDER_PX = 2;

export interface VirtualGrid {
  /** Ref callback for the grid container (merge with any other refs). */
  containerRef: (node: HTMLDivElement | null) => void;
  /** Columns per row; 0 until the container width is known. */
  columns: number;
  /** Virtual rows currently in the window (+ overscan). */
  rows: VirtualItem[];
  /** Ref callback for each rendered row (registers + measures it). */
  rowRef: (node: Element | null) => void;
  /**
   * Synchronously re-measure the container width. Returns true when it
   * changed and a re-render with the new column count is scheduled —
   * callers that need the new layout (useGridFlip.play) must skip and
   * wait for the next commit.
   */
  refreshWidth: () => boolean;
}

// Window-scrolled row virtualization for the library grid. Items are
// sliced into rows with the same column count the old
// `repeat(auto-fill, minmax(gridSize, 1fr))` grid produced, so card sizes
// don't shift. Only rows near the viewport stay mounted. With
// directDomUpdates the virtualizer owns the container height and the row
// transforms — React re-renders only when the visible row range changes,
// not on every scroll frame.
export function useVirtualGrid(itemCount: number, gridSize: number): VirtualGrid {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const [gaps, setGaps] = useState({ row: FALLBACK_ROW_GAP, col: FALLBACK_COL_GAP });
  const [scrollMargin, setScrollMargin] = useState(0);
  const scrollMarginRef = useRef(0);

  // Column count must mirror `repeat(auto-fill, minmax(gridSize, 1fr))`:
  // auto-fill yields floor((width + gap) / (minSize + gap)), at least 1.
  const columns =
    width > 0 ? Math.max(1, Math.floor((width + gaps.col) / (gridSize + gaps.col))) : 0;
  const rowCount = columns > 0 ? Math.ceil(itemCount / columns) : 0;

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => {
      if (columns < 1 || width < 1) return 300;
      const cardWidth = (width - (columns - 1) * gaps.col) / columns;
      return cardWidth * CARD_ASPECT + CARD_BORDER_PX + gaps.row;
    },
    overscan: 3,
    scrollMargin,
    directDomUpdates: true,
  });

  const measureWidth = useCallback(() => {
    const node = containerRef.current;
    if (!node) return false;
    const w = node.clientWidth;
    if (Math.abs(w - widthRef.current) < 0.5) return false;
    widthRef.current = w;
    setWidth(w);
    return true;
  }, []);

  const readGaps = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    const cs = getComputedStyle(node);
    const row = parseFloat(cs.rowGap);
    const col = parseFloat(cs.columnGap);
    setGaps((prev) =>
      row === prev.row && col === prev.col
        ? prev
        : { row: row || FALLBACK_ROW_GAP, col: col || FALLBACK_COL_GAP },
    );
  }, []);

  const containerRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      virtualizer.containerRef(node);
      if (!node) return;
      // Measure synchronously so the first render with data already knows
      // the width — the ResizeObserver below only delivers after paint.
      measureWidth();
      readGaps();
    },
    [virtualizer, measureWidth, readGaps],
  );

  // Track container width across sidebar toggles, window resizes and
  // grid-size changes. Sidebar toggles are additionally refreshed
  // synchronously via refreshWidth() from the flip layout effect — RO
  // delivery alone can lag a frame behind the layout change. Width only:
  // reading computed styles inside the callback forces a sync style
  // recalc that trips ResizeObserver loop warnings, and the gaps are
  // static CSS vars already read once at container attach. The state
  // update is deferred to the next animation frame so the re-render (and
  // the row style writes it causes) never lands inside the RO delivery
  // frame — that write→layout→deliver cycle is what produces the
  // "ResizeObserver loop completed with undelivered notifications"
  // console error.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measureWidth();
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [measureWidth]);

  // Keep the virtualizer's scrollMargin (the container's offset from the
  // top of the document) in sync with layout shifts above the grid: the
  // settings panel, error/status messages, etc. Deliberately runs after
  // every commit — layout above the grid can shift without any state
  // change. Only the virtualizer writes row transforms: they are
  // container-relative (it positions each row at item.start minus
  // scrollMargin), so rows move with the container when layout above
  // shifts and no DOM patch is needed. Patching transforms here would be
  // invisible to the virtualizer's internal position cache (it skips
  // rewrites when its computed offset is unchanged), leaving rows
  // displaced until they unmount and remount. setScrollMargin bails when
  // the measured top is unchanged, so the update chain converges.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    if (Math.abs(top - scrollMarginRef.current) < 0.5) return;
    scrollMarginRef.current = top;
    setScrollMargin(top);
  });

  return {
    containerRef: containerRefCallback,
    columns,
    rows: virtualizer.getVirtualItems(),
    rowRef: virtualizer.measureElement,
    refreshWidth: measureWidth,
  };
}
