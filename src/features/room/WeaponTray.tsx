import { useEffect, useState } from 'react';
import { WEAPONS } from './weapons.ts';
import WeaponShape from './WeaponShape.tsx';

const CLOSE_MS = 220;

interface WeaponTrayProps {
  open: boolean;
  selectedWeaponId?: string | null;
  onSelect: (weaponId: string) => void;
  onClose: () => void;
}

// Stays mounted for CLOSE_MS after `open` goes false so the sheet can slide
// down instead of vanishing instantly — picking a weapon or clicking the
// scrim both go through this same closing animation.
export default function WeaponTray({ open, selectedWeaponId, onSelect, onClose }: WeaponTrayProps) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
    } else if (rendered) {
      setClosing(true);
      const t = setTimeout(() => { setRendered(false); setClosing(false); }, CLOSE_MS);
      return () => clearTimeout(t);
    }
  }, [open, rendered]);

  if (!rendered) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50,
        animation: `${closing ? 'sp-scrim-fade-out' : 'sp-scrim-fade-in'} ${CLOSE_MS}ms ease both`,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--sp-panel)', border: '1px solid var(--sp-border)', borderRadius: '16px 16px 0 0', padding: '22px 26px 28px', width: 'min(560px, 92vw)', boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
          animation: `${closing ? 'sp-tray-slide-down' : 'sp-tray-slide-up'} ${CLOSE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--sp-text)', marginBottom: 14 }}>Choose your weapon</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {WEAPONS.map(w => (
            <button
              key={w.id}
              onClick={() => onSelect(w.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px',
                borderRadius: 10, border: selectedWeaponId === w.id ? '2px solid var(--sp-accent)' : '1px solid var(--sp-border)',
                background: 'var(--sp-card-bg)', cursor: 'pointer', fontFamily: 'var(--sp-font)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28 }}>
                {w.hasEmoji ? <span style={{ fontSize: 26, lineHeight: 1 }}>{w.glyph}</span> : <WeaponShape shape={w.shape} />}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sp-text-dim)' }}>{w.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
