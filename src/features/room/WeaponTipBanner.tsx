import { WEAPONS } from './weapons.ts';

const WEAPON_TIP_FADE_MS = 600;

interface WeaponTipBannerProps {
  equippedWeaponId: string | null;
  rendered: boolean;
  closing: boolean;
  onDismiss: () => void;
}

// The one-time "click someone to hit them" tip banner shown after equipping
// a weapon for the first time. See useWeaponTargeting for the show/fade logic.
export default function WeaponTipBanner({ equippedWeaponId, rendered, closing, onDismiss }: WeaponTipBannerProps) {
  if (!equippedWeaponId || !rendered) return null;
  return (
    <div
      className="fixed top-[72px] left-1/2 z-40 flex items-center gap-3 rounded-[10px] border border-sp-accent-border bg-sp-accent-panel-2-transparent px-3.5 py-2 text-[13px] font-bold whitespace-nowrap text-sp-accent-text backdrop-blur-[6px]"
      style={{ animation: `${closing ? 'sp-tip-fade-out' : 'sp-tip-fade-in'} ${WEAPON_TIP_FADE_MS}ms ease both` }}
    >
      <span>🎯 Throwing {WEAPONS.find(w => w.id === equippedWeaponId)?.label} — click someone to hit them</span>
      <button onClick={onDismiss} className="cursor-pointer border-none bg-transparent text-[13px] font-extrabold text-sp-accent-text">Close</button>
    </div>
  );
}
