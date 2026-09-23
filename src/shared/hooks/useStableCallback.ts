import { useCallback, useLayoutEffect, useRef } from 'react';

// A function whose identity never changes but always runs the latest `fn`.
// For handlers passed to memoized children that close over state which
// changes often -- a plain useCallback would change identity with that state
// and re-render the child anyway. Only for event handlers, never for render.
export function useStableCallback<Args extends unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => { ref.current = fn; });
  return useCallback((...args: Args) => ref.current(...args), []);
}
