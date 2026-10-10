import { useEffect, useState } from 'react';

// A number running from `from` down to `to` over `ms`, easing out so it
// slows as it lands; straight to `to` when motion is reduced.
export function useDescent(from: number, to: number, ms: number): number {
  const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [value, setValue] = useState(still ? to : from);
  useEffect(() => {
    if (still) { setValue(to); return; }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(from - (from - to) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, ms, still]);
  return value;
}
