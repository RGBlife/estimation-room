import { useEffect, useState, type RefObject } from 'react';

export interface Breakpoint {
  minWidth: number;
  panelWidth: number | null;
  columns: number;
  rows: number;
  stacked: boolean;
}

// Grid widens on bigger screens (more room either side of the join card), so
// more thumbnails fit per row/page without any horizontal scrolling.
const BREAKPOINTS: Breakpoint[] = [
  { minWidth: 1100, panelWidth: 780, columns: 6, rows: 2, stacked: false },
  { minWidth: 760, panelWidth: 620, columns: 4, rows: 2, stacked: false },
  { minWidth: 0, panelWidth: null, columns: 3, rows: 2, stacked: true },
];

// Widths the picker's own layout spends before any tile is drawn, mirroring
// the classes in AvatarCategoryPicker/OptionTile. Used to pick the column
// count from the space the builder actually has rather than from the
// viewport: the room's avatar dialog is capped at 620px, so on a wide screen
// the viewport rule alone asked for six columns and the sixth tile of every
// row was pushed out of the panel and clipped.
const TILE = 72;
const TILE_GAP = 14;
const PANEL_CHROME = 2 + 28; // panel border + p-3.5
const ARROWS = 2 * 24 + 2 * 8; // the two pager buttons and the gaps beside them
const RAIL = 100 + 14 + 1 + 12; // category rail, gap, divider, pl-3

export function requiredWidth(breakpoint: Breakpoint): number {
  const tiles = breakpoint.columns * TILE + (breakpoint.columns - 1) * TILE_GAP;
  return PANEL_CHROME + ARROWS + tiles + (breakpoint.stacked ? 0 : RAIL);
}

function viewportBreakpoint(): Breakpoint {
  const w = typeof window !== 'undefined' ? window.innerWidth : 0;
  // BREAKPOINTS always ends with a minWidth: 0 entry, so find always matches.
  return BREAKPOINTS.find((b) => w >= b.minWidth)!;
}

// The widest layout that fits in `width`. The last entry is the floor, so
// something is always returned even when nothing truly fits.
export function breakpointForWidth(width: number): Breakpoint {
  return BREAKPOINTS.find((b) => width >= requiredWidth(b)) ?? BREAKPOINTS[BREAKPOINTS.length - 1];
}

export function useViewportBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState(viewportBreakpoint);
  useEffect(() => {
    const onResize = () => setBreakpoint(viewportBreakpoint());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return breakpoint;
}

// Breakpoint sized to the element in `ref`, never wider than the viewport
// would allow. Until the element has been measured (first render, or an
// environment without ResizeObserver) it falls back to the viewport rule.
export function useContainerBreakpoint(ref: RefObject<HTMLElement | null>): Breakpoint {
  const viewport = useViewportBreakpoint();
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const measure = () => setWidth(node.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  if (width === null) return viewport;
  const fitting = breakpointForWidth(width);
  return fitting.columns < viewport.columns ? fitting : viewport;
}

export function useAvatarPanelWidth(expanded: boolean): number | null {
  const breakpoint = useViewportBreakpoint();
  return expanded ? breakpoint.panelWidth : null;
}
