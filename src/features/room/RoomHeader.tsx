import ThemeToggle from '../../shared/ui/ThemeToggle.tsx';
import useMediaQuery from '../../shared/hooks/useMediaQuery.ts';
import { WEAPONS } from './weapons.ts';
import DeckSwitcher from './DeckSwitcher.tsx';
import type { Theme } from '../../shared/lib/theme.ts';
import type { DeckDefinition } from './decks.ts';
import type { DeckId } from '../../types/room.ts';

// GTA Mode only responds to a physical keyboard (WASD/arrows) -- on-screen
// touch controls are a separate, not-yet-built feature. Offering the button
// on a touch-only device would just strand the driver in an uncontrollable
// car, so it's hidden there entirely; spectating other drivers still works
// fully regardless of this device's own input.
const TOUCH_PRIMARY_QUERY = '(pointer: coarse)';

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
  deck: DeckDefinition;
  onSwitchDeck: (deckId: DeckId) => void;
  equippedWeaponId: string | null;
  onCancelTargeting: () => void;
  onOpenWeaponTray: () => void;
  isRevealed: boolean;
  isDriving: boolean;
  onStartDriving: () => void;
  onSwitchRole: (isObserver: boolean) => void;
  onLeave: () => void;
}

// Top bar: room code / copy-link, story title, theme toggle, deck switcher
// (host-only), weapon-equip button, GTA Mode button, role switch, and leave
// button.
export default function RoomHeader({
  roomCode, copied, onCopy, isCreator, storyDraft, storyInputRef, onStoryChange, story,
  theme, onToggleTheme, isObserver, deck, onSwitchDeck, equippedWeaponId, onCancelTargeting, onOpenWeaponTray,
  isRevealed, isDriving, onStartDriving,
  onSwitchRole, onLeave,
}: RoomHeaderProps) {
  const touchPrimary = useMediaQuery(TOUCH_PRIMARY_QUERY);
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 border-b border-sp-border px-7 py-4">
      <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-5">
        <div aria-hidden="true" className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-sp-accent font-sp-mono text-[10px] font-bold text-sp-bg">ER</div>
        <button
          onClick={onCopy}
          title="Copy shareable invite link"
          aria-label={`Room ${roomCode.split('').join(' ')}. Copy shareable invite link`}
          className="flex cursor-pointer items-center gap-[7px] rounded-md border border-sp-border bg-sp-panel px-2.5 py-1.5 text-sp-text-dim"
        >
          <span aria-hidden="true" className="font-sp-mono text-[13px] tracking-[0.08em]">{roomCode}</span>
          <span aria-hidden="true" className="text-[11px] text-sp-text-faint">{copied ? 'link copied' : 'copy link'}</span>
        </button>
        {/* Announced separately from the button label so the confirmation is
            read out on click -- a label change alone isn't reliably announced. */}
        <span aria-live="polite" className="sr-only">{copied ? 'Invite link copied to clipboard' : ''}</span>

        {isCreator ? (
          <div className="relative min-w-[180px] max-w-[420px] flex-1">
            <input
              ref={storyInputRef}
              value={storyDraft}
              onChange={onStoryChange}
              maxLength={STORY_MAX_LENGTH}
              aria-label="Story title or ticket reference"
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
        {isCreator && <DeckSwitcher currentDeckId={deck.id} onSwitch={onSwitchDeck} />}
        {!isObserver && (
          equippedWeaponId ? (
            <button onClick={onCancelTargeting} className="cursor-pointer whitespace-nowrap rounded-md border border-sp-accent-border bg-sp-accent-panel-2 px-3.5 py-2.5 font-sp-font text-xs font-bold text-sp-accent-text">
              Cancel throwing {WEAPONS.find(w => w.id === equippedWeaponId)?.label}
            </button>
          ) : (
            <button onClick={onOpenWeaponTray} className="cursor-pointer whitespace-nowrap rounded-md border-none bg-sp-accent px-3.5 py-2.5 font-sp-font text-xs font-bold text-sp-bg">🎯 Choose Your Weapon</button>
          )
        )}
        {/* Only once the round's votes are revealed -- a fun beat between
            reveal and starting the next round, not a mid-vote distraction.
            Hidden on touch-only devices: driving needs a physical keyboard,
            which on-screen controls don't yet replace. */}
        {!isObserver && isRevealed && !touchPrimary && (
          <button
            onClick={onStartDriving}
            disabled={isDriving}
            className={`whitespace-nowrap rounded-md border-none px-3.5 py-2.5 font-sp-font text-xs font-bold ${
              isDriving
                ? 'cursor-default bg-sp-panel-2 text-sp-text-faint opacity-50'
                : 'cursor-pointer bg-sp-accent text-sp-bg'
            }`}
          >🚗 GTA Mode</button>
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
