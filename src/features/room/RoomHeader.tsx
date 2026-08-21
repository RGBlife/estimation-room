import { useEffect, useRef } from 'react';
import ThemeToggle from '../../shared/ui/ThemeToggle.tsx';
import useMediaQuery from '../../shared/hooks/useMediaQuery.ts';
import { WEAPONS } from './weapons.ts';
import DeckSwitcher from './DeckSwitcher.tsx';
import RoomMenu from './RoomMenu.tsx';
import type { Theme } from '../../shared/lib/theme.ts';
import type { DeckDefinition } from './decks.ts';
import type { DeckId } from '../../types/room.ts';

// GTA Mode only responds to a physical keyboard (WASD/arrows) -- on-screen
// touch controls are a separate, not-yet-built feature. Offering the button
// on a touch-only device would just strand the driver in an uncontrollable
// car, so it's hidden there entirely; spectating other drivers still works
// fully regardless of this device's own input.
const TOUCH_PRIMARY_QUERY = '(pointer: coarse)';

// Phone-width layout: tighter padding and gaps, and the long button labels
// drop to their icon/short form so the control group fits one or two rows
// instead of stacking one nowrap button per row.
const NARROW_QUERY = '(max-width: 559px)';
// Tablets and small windows have room for the full labels but not for the
// desktop padding as well -- without this the control group still wrapped to
// a third row at 768px.
const SNUG_QUERY = '(max-width: 900px)';

interface RoomHeaderProps {
  roomCode: string;
  copied: boolean;
  onCopy: () => void;
  isCreator: boolean;
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
  // Reports the header's rendered height so overlays positioned beneath it
  // (WeaponTipBanner) can sit below wherever it actually ends. It wraps to
  // several rows on a narrow screen, so a fixed offset lands mid-header.
  onHeightChange?: (height: number) => void;
}

// Top bar: room code / copy-link, theme toggle, deck switcher (host-only),
// weapon-equip button, GTA Mode button, role switch, and leave button.
export default function RoomHeader({
  roomCode, copied, onCopy, isCreator,
  theme, onToggleTheme, isObserver, deck, onSwitchDeck, equippedWeaponId, onCancelTargeting, onOpenWeaponTray,
  isRevealed, isDriving, onStartDriving,
  onSwitchRole, onLeave, onHeightChange,
}: RoomHeaderProps) {
  const touchPrimary = useMediaQuery(TOUCH_PRIMARY_QUERY);
  const narrow = useMediaQuery(NARROW_QUERY);
  const snug = useMediaQuery(SNUG_QUERY);
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = headerRef.current;
    if (!node || !onHeightChange) return;
    // Border-box, so the reported height includes padding and the bottom
    // border rather than just the content.
    const observer = new ResizeObserver(() => onHeightChange(node.getBoundingClientRect().height));
    observer.observe(node);
    return () => observer.disconnect();
  }, [onHeightChange]);
  return (
    <div
      ref={headerRef}
      className={`flex flex-wrap items-center justify-between border-b border-sp-border ${narrow ? 'gap-2 px-3 py-2.5' : snug ? 'gap-3 px-4 py-3' : 'gap-5 px-7 py-4'}`}
    >
      {/* The 280px min-width reserved most of a phone's width for the room
          code alone, forcing every control on the right onto its own row and
          stacking the header several rows tall. */}
      <div className={`flex flex-1 flex-wrap items-center ${narrow ? 'min-w-0 gap-2' : snug ? 'min-w-0 gap-3' : 'min-w-[280px] gap-5'}`}>
        <div aria-hidden="true" className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-sp-accent font-sp-mono text-[10px] font-bold text-sp-bg">ER</div>
        <button
          onClick={onCopy}
          title="Copy shareable invite link"
          aria-label={`Room ${roomCode.split('').join(' ')}. Copy shareable invite link`}
          className={`flex cursor-pointer items-center rounded-md border border-sp-border bg-sp-panel px-2.5 text-sp-text-dim ${narrow || touchPrimary ? 'min-h-[44px] gap-2' : 'gap-[7px] py-1.5'}`}
        >
          <span aria-hidden="true" className="font-sp-mono text-[13px] tracking-[0.08em]">{roomCode}</span>
          <span aria-hidden="true" className="text-[11px] text-sp-text-faint">{copied ? 'link copied' : 'copy link'}</span>
        </button>
        {/* Announced separately from the button label so the confirmation is
            read out on click -- a label change alone isn't reliably announced. */}
        <span aria-live="polite" className="sr-only">{copied ? 'Invite link copied to clipboard' : ''}</span>
      </div>

      {/* On a phone only the weapon button stays out in the open -- it's the
          one control tied to what you're doing right now. Everything else is
          a preference or a room action, and each was being squeezed under the
          44px a finger needs; the menu gives them full-size rows instead. */}
      {narrow ? (
        <div className="flex items-center gap-2">
          {/* Stays out of the menu: it's the host's most-used control, and it
              already opens its own picker rather than acting immediately. */}
          {isCreator && <DeckSwitcher currentDeckId={deck.id} onSwitch={onSwitchDeck} />}
          {!isObserver && (
            equippedWeaponId ? (
              <button
                onClick={onCancelTargeting}
                aria-label={`Cancel throwing ${WEAPONS.find(w => w.id === equippedWeaponId)?.label}`}
                className="min-h-[44px] cursor-pointer rounded-md border border-sp-accent-border bg-sp-accent-panel-2 px-3 font-sp-font text-xs font-bold whitespace-nowrap text-sp-accent-text"
              >Cancel</button>
            ) : (
              <button
                onClick={onOpenWeaponTray}
                aria-label="Choose Your Weapon"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border-none bg-sp-accent text-base"
              >🎯</button>
            )
          )}
          <RoomMenu
            items={[
              { label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', onSelect: onToggleTheme },
              ...(!isObserver && isRevealed && !touchPrimary ? [{ label: '🚗 GTA Mode', onSelect: onStartDriving }] : []),
              isObserver
                ? { label: 'Switch to voting', onSelect: () => onSwitchRole(false), accent: true }
                : { label: 'Switch to observing', onSelect: () => onSwitchRole(true), accent: true },
              { label: 'Leave room', onSelect: onLeave },
            ]}
          />
        </div>
      ) : (
      // A tablet is wide enough for the full labels but still operated by
      // finger, so every control here takes the 44px minimum when the
      // pointer is coarse. `touch` is a no-op on a mouse-driven desktop.
      <div className={`flex flex-wrap items-center justify-end ${snug ? 'gap-2' : 'gap-4'} ${touchPrimary ? '[&_button]:min-h-[44px]' : ''}`}>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} size={touchPrimary ? 44 : 34} />
        {isCreator && <DeckSwitcher currentDeckId={deck.id} onSwitch={onSwitchDeck} />}
        {!isObserver && (
          equippedWeaponId ? (
            <button
              onClick={onCancelTargeting}
              className="cursor-pointer whitespace-nowrap rounded-md border border-sp-accent-border bg-sp-accent-panel-2 px-3.5 py-2.5 font-sp-font text-xs font-bold text-sp-accent-text"
            >
              Cancel throwing {WEAPONS.find(w => w.id === equippedWeaponId)?.label}
            </button>
          ) : (
            <button
              onClick={onOpenWeaponTray}
              className="cursor-pointer whitespace-nowrap rounded-md border-none bg-sp-accent px-3.5 py-2.5 font-sp-font text-xs font-bold text-sp-bg"
            >🎯 Choose Your Weapon</button>
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
          <button
            onClick={() => onSwitchRole(true)}
            className="cursor-pointer rounded-md border border-sp-border-strong bg-sp-panel-2 px-3 py-2 font-sp-font text-xs font-semibold text-sp-text-dim"
          >Switch to observing</button>
        ) : (
          <button
            onClick={() => onSwitchRole(false)}
            className="cursor-pointer rounded-md border border-sp-accent-border bg-sp-accent-panel-2 px-3 py-2 font-sp-font text-xs font-semibold text-sp-accent-text"
          >Switch to voting</button>
        )}
        <button onClick={onLeave} className="cursor-pointer border-none bg-transparent text-xs text-sp-text-faintest">Leave room</button>
      </div>
      )}
    </div>
  );
}
