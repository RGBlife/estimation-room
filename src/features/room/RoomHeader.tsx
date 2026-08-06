import ThemeToggle from '../../shared/ui/ThemeToggle.tsx';
import { WEAPONS } from './weapons.ts';
import type { Theme } from '../../shared/lib/theme.ts';

const STORY_MAX_LENGTH = 200;

interface RoomHeaderProps {
  roomCode: string;
  copied: boolean;
  onCopy: () => void;
  isCreator: boolean;
  storyDraft: string;
  storyInputRef: React.RefObject<HTMLInputElement | null>;
  onStoryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  story: string;
  theme: Theme;
  onToggleTheme: () => void;
  isObserver: boolean;
  equippedWeaponId: string | null;
  onCancelTargeting: () => void;
  onOpenWeaponTray: () => void;
  onSwitchRole: (isObserver: boolean) => void;
  onLeave: () => void;
}

// Top bar: room code / copy-link, story title, theme toggle, weapon-equip
// button, role switch, and leave button.
export default function RoomHeader({
  roomCode, copied, onCopy, isCreator, storyDraft, storyInputRef, onStoryChange, story,
  theme, onToggleTheme, isObserver, equippedWeaponId, onCancelTargeting, onOpenWeaponTray,
  onSwitchRole, onLeave,
}: RoomHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid var(--sp-border)', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--sp-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sp-mono)', fontWeight: 700, fontSize: 10, color: 'var(--sp-bg)' }}>ER</div>
        <button onClick={onCopy} title="Copy shareable invite link" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--sp-panel)', border: '1px solid var(--sp-border)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: 'var(--sp-text-dim)' }}>
          <span style={{ fontFamily: 'var(--sp-mono)', fontSize: 13, letterSpacing: '0.08em' }}>{roomCode}</span>
          <span style={{ fontSize: 11, color: 'var(--sp-text-faint)' }}>{copied ? 'link copied' : 'copy link'}</span>
        </button>

        {isCreator ? (
          <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 420 }}>
            <input
              ref={storyInputRef}
              value={storyDraft}
              onChange={onStoryChange}
              maxLength={STORY_MAX_LENGTH}
              placeholder="Click to add a story title or ticket ref..."
              style={{ width: '100%', background: 'transparent', border: '1px solid transparent', borderRadius: 7, padding: '6px 10px', color: 'var(--sp-text)', fontFamily: 'var(--sp-mono)', fontSize: 14, outline: 'none' }}
            />
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--sp-mono)', fontSize: 14, color: 'var(--sp-text-dim)', padding: '6px 10px' }}>{story || 'Untitled story'}</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} size={34} />
        {!isObserver && (
          equippedWeaponId ? (
            <button onClick={onCancelTargeting} style={{ border: '1px solid var(--sp-accent-border)', background: 'var(--sp-accent-panel-2)', color: 'var(--sp-accent-text)', fontWeight: 700, fontFamily: 'var(--sp-font)', padding: '9px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
              Cancel throwing {WEAPONS.find(w => w.id === equippedWeaponId)?.label}
            </button>
          ) : (
            <button onClick={onOpenWeaponTray} style={{ border: 'none', background: 'var(--sp-accent)', color: 'var(--sp-bg)', fontWeight: 700, fontFamily: 'var(--sp-font)', padding: '9px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>🎯 Choose Your Weapon</button>
          )
        )}
        {!isObserver ? (
          <button onClick={() => onSwitchRole(true)} style={{ background: 'var(--sp-panel-2)', border: '1px solid var(--sp-border-strong)', borderRadius: 7, padding: '8px 12px', color: 'var(--sp-text-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Switch to observing</button>
        ) : (
          <button onClick={() => onSwitchRole(false)} style={{ background: 'var(--sp-accent-panel-2)', border: '1px solid var(--sp-accent-border)', borderRadius: 7, padding: '8px 12px', color: 'var(--sp-accent-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Switch to voting</button>
        )}
        <button onClick={onLeave} style={{ background: 'none', border: 'none', color: 'var(--sp-text-faintest)', fontSize: 12, cursor: 'pointer' }}>Leave room</button>
      </div>
    </div>
  );
}
