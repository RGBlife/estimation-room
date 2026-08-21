import { WEAPONS } from './weapons.ts';

const WEAPON_TIP_FADE_MS = 600;

interface WeaponTipBannerProps {
  equippedWeaponId: string | null;
  rendered: boolean;
  closing: boolean;
  onDismiss: () => void;
  // Distance from the top, measured from the real header height by the
  // caller -- the header wraps to several rows on a narrow screen, so a fixed
  // offset used to drop this banner on top of the header's own controls.
  top?: number;
}

const DEFAULT_TOP = 72;

// The one-time "click someone to hit them" tip banner shown after equipping
// a weapon for the first time. See useWeaponTargeting for the show/fade logic.
export default function WeaponTipBanner({ equippedWeaponId, rendered, closing, onDismiss, top = DEFAULT_TOP }: WeaponTipBannerProps) {
  if (!equippedWeaponId || !rendered) return null;
  return (
    // The horizontal centring lives in the sp-tip-fade-in/out keyframes
    // (translate(-50%, ...)), so there's no -translate-x-1/2 class here to
    // fight with it. Wrapping is allowed so a long weapon name can't push the
    // banner off both edges of a phone.
    <div
      className="fixed left-1/2 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-[10px] border border-sp-accent-border bg-sp-accent-panel-2-transparent px-3.5 py-2 text-[13px] font-bold text-sp-accent-text backdrop-blur-[6px]"
      style={{ top, animation: `${closing ? 'sp-tip-fade-out' : 'sp-tip-fade-in'} ${WEAPON_TIP_FADE_MS}ms ease both` }}
    >
      <span>🎯 Throwing {WEAPONS.find(w => w.id === equippedWeaponId)?.label} — click someone to hit them</span>
      <button onClick={onDismiss} className="shrink-0 cursor-pointer border-none bg-transparent text-[13px] font-extrabold text-sp-accent-text">Close</button>
    </div>
  );
}
