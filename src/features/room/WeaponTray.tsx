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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      style={{ animation: `${closing ? 'sp-scrim-fade-out' : 'sp-scrim-fade-in'} ${CLOSE_MS}ms ease both` }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-t-2xl border border-sp-border bg-sp-panel px-6.5 pt-5.5 pb-7 shadow-[0_-10px_30px_rgba(0,0,0,0.4)]"
        style={{
          width: 'min(560px, 92vw)',
          animation: `${closing ? 'sp-tray-slide-down' : 'sp-tray-slide-up'} ${CLOSE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
        }}
      >
        <div className="mb-3.5 text-[17px] font-extrabold text-sp-text">Choose your weapon</div>
        <div className="grid grid-cols-4 gap-3">
          {WEAPONS.map(w => (
            <button
              key={w.id}
              onClick={() => onSelect(w.id)}
              className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-[10px] bg-sp-card-bg px-2 py-3 font-sp-font ${selectedWeaponId === w.id ? 'border-2 border-sp-accent' : 'border border-sp-border'}`}
            >
              <div className="flex h-7 w-7 items-center justify-center">
                {w.hasEmoji ? <span className="text-[26px] leading-none">{w.glyph}</span> : <WeaponShape shape={w.shape} />}
              </div>
              <span className="text-[11px] font-bold text-sp-text-dim">{w.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
