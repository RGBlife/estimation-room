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
      style={{
        position: 'fixed', top: 72, left: '50%', zIndex: 40,
        background: 'var(--sp-accent-panel-2-transparent)', backdropFilter: 'blur(6px)',
        border: '1px solid var(--sp-accent-border)', borderRadius: 10, padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        fontWeight: 700, fontSize: 13, color: 'var(--sp-accent-text)', whiteSpace: 'nowrap',
        animation: `${closing ? 'sp-tip-fade-out' : 'sp-tip-fade-in'} ${WEAPON_TIP_FADE_MS}ms ease both`,
      }}
    >
      <span>🎯 Throwing {WEAPONS.find(w => w.id === equippedWeaponId)?.label} — click someone to hit them</span>
      <button onClick={onDismiss} style={{ border: 'none', background: 'none', fontWeight: 800, color: 'var(--sp-accent-text)', cursor: 'pointer', fontSize: 13 }}>Close</button>
    </div>
  );
}
