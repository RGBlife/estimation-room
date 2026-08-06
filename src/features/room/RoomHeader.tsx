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
    <div className="flex flex-wrap items-center justify-between gap-5 border-b border-sp-border px-7 py-4">
      <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-5">
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-sp-accent font-sp-mono text-[10px] font-bold text-sp-bg">ER</div>
        <button onClick={onCopy} title="Copy shareable invite link" className="flex cursor-pointer items-center gap-[7px] rounded-md border border-sp-border bg-sp-panel px-2.5 py-1.5 text-sp-text-dim">
          <span className="font-sp-mono text-[13px] tracking-[0.08em]">{roomCode}</span>
          <span className="text-[11px] text-sp-text-faint">{copied ? 'link copied' : 'copy link'}</span>
        </button>

        {isCreator ? (
          <div className="relative min-w-[180px] max-w-[420px] flex-1">
            <input
              ref={storyInputRef}
              value={storyDraft}
              onChange={onStoryChange}
              maxLength={STORY_MAX_LENGTH}
              placeholder="Click to add a story title or ticket ref..."
              className="w-full rounded-md border border-transparent bg-transparent px-2.5 py-1.5 font-sp-mono text-sm text-sp-text outline-none"
            />
          </div>
        ) : (
          <div className="px-2.5 py-1.5 font-sp-mono text-sm text-sp-text-dim">{story || 'Untitled story'}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} size={34} />
        {!isObserver && (
          equippedWeaponId ? (
            <button onClick={onCancelTargeting} className="cursor-pointer whitespace-nowrap rounded-md border border-sp-accent-border bg-sp-accent-panel-2 px-3.5 py-2.5 font-sp-font text-xs font-bold text-sp-accent-text">
              Cancel throwing {WEAPONS.find(w => w.id === equippedWeaponId)?.label}
            </button>
          ) : (
            <button onClick={onOpenWeaponTray} className="cursor-pointer whitespace-nowrap rounded-md border-none bg-sp-accent px-3.5 py-2.5 font-sp-font text-xs font-bold text-sp-bg">🎯 Choose Your Weapon</button>
          )
        )}
        {!isObserver ? (
          <button onClick={() => onSwitchRole(true)} className="cursor-pointer rounded-md border border-sp-border-strong bg-sp-panel-2 px-3 py-2 font-sp-font text-xs font-semibold text-sp-text-dim">Switch to observing</button>
        ) : (
          <button onClick={() => onSwitchRole(false)} className="cursor-pointer rounded-md border border-sp-accent-border bg-sp-accent-panel-2 px-3 py-2 font-sp-font text-xs font-semibold text-sp-accent-text">Switch to voting</button>
        )}
        <button onClick={onLeave} className="cursor-pointer border-none bg-transparent text-xs text-sp-text-faintest">Leave room</button>
      </div>
    </div>
  );
}
