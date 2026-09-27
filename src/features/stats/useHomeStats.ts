import { useEffect, useState, type RefObject } from 'react';
import { fetchHomeStats, measurePing, type HomeStats } from './homeStats.ts';

const REFRESH_MS = 30_000;

export type HomeStatsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; stats: HomeStats; ping: number | null }
  | { kind: 'error' };

// Loads the stats only once the section scrolls into view, then refreshes
// every 30 seconds while it stays visible and the tab is in front. Most visits
// never scroll this far, so they never ask the server for anything.
export function useHomeStats(target: RefObject<Element | null>): HomeStatsState {
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<HomeStatsState>({ kind: 'idle' });

  useEffect(() => {
    const node = target.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '0px 0px 200px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [target]);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let ping: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (document.visibilityState === 'hidden') { timer = setTimeout(load, REFRESH_MS); return; }
      setState(current => (current.kind === 'ready' ? current : { kind: 'loading' }));
      try {
        const stats = await fetchHomeStats(controller.signal);
        // Ping once per visit; it's about this browser, not the server.
        if (ping === null) ping = await measurePing(3, controller.signal).catch(() => null);
        setState({ kind: 'ready', stats, ping });
      } catch {
        if (controller.signal.aborted) return;
        setState(current => (current.kind === 'ready' ? current : { kind: 'error' }));
      }
      if (!controller.signal.aborted) timer = setTimeout(load, REFRESH_MS);
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [visible]);

  return state;
}
