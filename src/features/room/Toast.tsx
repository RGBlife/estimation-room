interface ToastProps {
  message: string | null;
  rendered: boolean;
  closing: boolean;
}

const TOAST_FADE_MS = 300;

// Minimal, single-instance auto-dismissing toast. See useDeckSwitchToast for
// the rendered/closing/timeout logic, modeled on WeaponTipBanner's pattern.
export default function Toast({ message, rendered, closing }: ToastProps) {
  if (!message || !rendered) return null;
  return (
    <div
      className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-sp-accent-border bg-sp-accent-panel-2-transparent px-3.5 py-2.5 text-[13px] font-semibold whitespace-nowrap text-sp-text backdrop-blur-[6px]"
      style={{ animation: `sp-fade-rise ${TOAST_FADE_MS}ms ease ${closing ? 'reverse' : 'normal'} both` }}
    >
      {message}
    </div>
  );
}
