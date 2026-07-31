import { WEAPONS } from '../lib/weapons.js';

function WeaponShape({ shape }) {
  if (shape === 'microwave') {
    return (
      <div style={{ width: 26, height: 19, borderRadius: 4, background: '#c7cdd6', border: '2px solid #4a5568', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 3, left: 3, width: 11, height: 11, borderRadius: '50%', background: '#2b3440' }} />
      </div>
    );
  }
  if (shape === 'snowball') {
    return (
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fdfeff', border: '2px solid #cfe3f7', boxShadow: 'inset -3px -3px 0 #e3eef9' }} />
    );
  }
  return null;
}

export default function WeaponTray({ selectedWeaponId, onSelect, onClose }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--sp-panel)', border: '1px solid var(--sp-border)', borderRadius: '16px 16px 0 0', padding: '22px 26px 28px', width: 'min(560px, 92vw)', boxShadow: '0 -10px 30px rgba(0,0,0,0.4)' }}
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
              {w.hasEmoji ? <span style={{ fontSize: 26 }}>{w.glyph}</span> : <WeaponShape shape={w.shape} />}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sp-text-dim)' }}>{w.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
