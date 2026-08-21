interface ToastProps {
  message: string | null;
  rendered: boolean;
  closing: boolean;
  // Distance from the viewport bottom, measured by the caller so this clears
  // the voting bar at whatever height it currently is.
  bottom?: number;
}

const TOAST_FADE_MS = 300;
const DEFAULT_BOTTOM = 96;

// Minimal, single-instance auto-dismissing toast. See useDeckSwitchToast for
// the rendered/closing/timeout logic, modeled on WeaponTipBanner's pattern.
export default function Toast({ message, rendered, closing, bottom = DEFAULT_BOTTOM }: ToastProps) {
  if (!message || !rendered) return null;
  return (
    // Wraps rather than running off both edges: the deck-switch message is
    // ~55 characters, which as a single nowrap line is wider than a phone
    // viewport -- and being fixed, the overflow couldn't even be scrolled to.
    <div
      className="fixed left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border border-sp-accent-border bg-sp-accent-panel-2-transparent px-3.5 py-2.5 text-center text-[13px] font-semibold text-balance text-sp-text backdrop-blur-[6px]"
      style={{ bottom, animation: `sp-fade-rise ${TOAST_FADE_MS}ms ease ${closing ? 'reverse' : 'normal'} both` }}
    >
      {message}
    </div>
  );
}
