import { AVATAR_BG } from './avatar.ts';

interface AvatarPreviewHeaderProps {
  avatarUrl: string;
  bgIdx: number;
  onShuffle: () => void;
  onSelectBg: (i: number) => void;
}

export default function AvatarPreviewHeader({ avatarUrl, bgIdx, onShuffle, onSelectBg }: AvatarPreviewHeaderProps) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 104, height: 104, borderRadius: '50%', overflow: 'hidden', flex: 'none', background: 'var(--sp-bg)', border: '1px solid var(--sp-card-idle-border)' }}>
          <img src={avatarUrl} alt="avatar preview" style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
        <button
          onClick={onShuffle}
          title="Randomise"
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

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sp-text-faintest)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>Background</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
          {AVATAR_BG.map((hex, i) => (
            <button
              key={hex}
              onClick={() => onSelectBg(i)}
              style={{ width: 24, height: 24, borderRadius: '50%', background: '#' + hex, cursor: 'pointer', padding: 0, border: '2px solid transparent', position: 'relative' }}
            >
              {bgIdx === i && (
                <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1.5px solid var(--sp-accent)' }} />
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
