import { useCallback, useEffect, useRef, useState } from 'react';

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);

  useEffect(() => () => {
    generation.current++;
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(async (text: string) => {
    const request = ++generation.current;
    if (timer.current !== null) clearTimeout(timer.current);
    setCopied(false);
    // Let callers display a useful error when clipboard access is unavailable.
    await navigator.clipboard.writeText(text);
    if (request !== generation.current) return;
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 1400);
  }, []);

  return { copied, copy };
}
