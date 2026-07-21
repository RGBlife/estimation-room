import { AVATAR_BG, buildAdventurerUrl } from '../lib/avatar.js';

function toggleBtnStyle(active) {
  return {
    width: 36, height: 36, borderRadius: 8,
    background: active ? 'var(--sp-accent-panel-3)' : 'var(--sp-panel-2)',
    border: `1px solid ${active ? 'var(--sp-accent)' : 'var(--sp-border)'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    color: active ? 'oklch(0.85 0.14 265)' : 'var(--sp-text-dimmer)',
    flex: 'none',
  };
}

export default function AvatarBuilder({ avatar, onChange }) {
  const avatarUrl = buildAdventurerUrl(avatar.seed, AVATAR_BG[avatar.bgIdx], avatar.glasses, avatar.earrings, avatar.flair);

  const shuffle = () => onChange({ ...avatar, seed: Math.random().toString(36).slice(2, 10) });
  const selectBg = (idx) => onChange({ ...avatar, bgIdx: idx });
  const toggle = (key) => onChange({ ...avatar, [key]: !avatar[key] });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 24, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 104, height: 104, borderRadius: '50%', overflow: 'hidden', flex: 'none', background: 'var(--sp-bg)', border: '1px solid oklch(1 0 0 / 0.1)' }}>
          <img src={avatarUrl} alt="avatar preview" style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
        <button
          onClick={shuffle}
          title="Shuffle look"
          style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--sp-panel-2)', border: '1px solid var(--sp-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--sp-text-dim)', flex: 'none' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8"></polyline>
            <line x1="4" y1="20" x2="21" y2="3"></line>
            <polyline points="21 16 21 21 16 21"></polyline>
            <line x1="15" y1="15" x2="21" y2="21"></line>
            <line x1="4" y1="4" x2="9" y2="9"></line>
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sp-text-faintest)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>Background</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
            {AVATAR_BG.map((hex, i) => (
              <button
                key={hex}
                onClick={() => selectBg(i)}
                style={{ width: 24, height: 24, borderRadius: '50%', background: '#' + hex, cursor: 'pointer', padding: 0, border: '2px solid transparent', position: 'relative' }}
              >
                {avatar.bgIdx === i && (
                  <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1.5px solid var(--sp-accent)' }} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sp-text-faintest)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>Details</div>
          <div style={{ display: 'flex', gap: 7, justifyContent: 'center' }}>
            <button onClick={() => toggle('glasses')} title="Glasses" style={toggleBtnStyle(avatar.glasses)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="15" r="4"></circle><circle cx="18" cy="15" r="4"></circle>
                <path d="M10 15h4M2 15l2-7h2M22 15l-2-7h-2"></path>
              </svg>
            </button>
            <button onClick={() => toggle('earrings')} title="Earrings" style={toggleBtnStyle(avatar.earrings)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="6" r="3"></circle><path d="M12 9v6a3 3 0 0 0 3 3"></path>
              </svg>
            </button>
            <button onClick={() => toggle('flair')} title="Flair" style={toggleBtnStyle(avatar.flair)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4L12 2z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function makeAvatarUrl(avatar) {
  return buildAdventurerUrl(avatar.seed, AVATAR_BG[avatar.bgIdx], avatar.glasses, avatar.earrings, avatar.flair);
}
