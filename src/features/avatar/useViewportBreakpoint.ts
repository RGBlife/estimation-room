import { useEffect, useState } from 'react';

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

export function useViewportBreakpoint(): Breakpoint {
  const getBreakpoint = (): Breakpoint => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 0;
    // BREAKPOINTS always ends with a minWidth: 0 entry, so find always matches.
    return BREAKPOINTS.find((b) => w >= b.minWidth)!;
  };
  const [breakpoint, setBreakpoint] = useState(getBreakpoint);
  useEffect(() => {
    const onResize = () => setBreakpoint(getBreakpoint());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return breakpoint;
}

export function useAvatarPanelWidth(expanded: boolean): number | null {
  const breakpoint = useViewportBreakpoint();
  return expanded ? breakpoint.panelWidth : null;
}
