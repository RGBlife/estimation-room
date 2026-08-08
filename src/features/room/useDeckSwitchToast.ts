import { useEffect, useRef, useState } from 'react';

const TOAST_VISIBLE_MS = 2600;
const TOAST_FADE_MS = 300;

interface UseDeckSwitchToastResult {
  message: string | null;
  rendered: boolean;
  closing: boolean;
  show: (message: string) => void;
  dismiss: () => void;
}

// Owns a single auto-dismissing toast's rendered/closing/message state,
// mirroring useWeaponTargeting's tip-banner timeout chain.
export function useDeckSwitchToast(): UseDeckSwitchToastResult {
  const [message, setMessage] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const [closing, setClosing] = useState(false);
  const visibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    clearTimeout(visibleTimerRef.current ?? undefined);
    setClosing(true);
    clearTimeout(fadeTimerRef.current ?? undefined);
    fadeTimerRef.current = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, TOAST_FADE_MS);
  };

  const show = (nextMessage: string) => {
    setMessage(nextMessage);
    setRendered(true);
    setClosing(false);
    clearTimeout(visibleTimerRef.current ?? undefined);
    clearTimeout(fadeTimerRef.current ?? undefined);
    visibleTimerRef.current = setTimeout(dismiss, TOAST_VISIBLE_MS);
  };

  useEffect(() => () => {
    clearTimeout(visibleTimerRef.current ?? undefined);
    clearTimeout(fadeTimerRef.current ?? undefined);
  }, []);

  return { message, rendered, closing, show, dismiss };
}
