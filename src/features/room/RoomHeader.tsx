import { useEffect, useRef } from 'react';
import useMediaQuery from '../../shared/hooks/useMediaQuery.ts';
import { WEAPONS } from './weapons.ts';
import RoomMenu from './RoomMenu.tsx';
import TeamNameEditor from './TeamNameEditor.tsx';
import { DECKS, DECK_ORDER } from './decks.ts';
import type { Theme } from '../../shared/lib/theme.ts';
import type { DeckDefinition } from './decks.ts';
import type { DeckId } from '../../types/room.ts';

// GTA Mode only responds to a physical keyboard (WASD/arrows) -- on-screen
// touch controls are a separate, not-yet-built feature. Offering the button
// on a touch-only device would just strand the driver in an uncontrollable
// car, so it's hidden there entirely; spectating other drivers still works
// fully regardless of this device's own input.
const TOUCH_PRIMARY_QUERY = '(pointer: coarse)';

// Compact phone/tablet layout: leave room for the avatar editor button. Long labels
// drop to their icon/short form so the control group fits one or two rows
// instead of stacking one nowrap button per row.
const NARROW_QUERY = '(max-width: 900px)';
// Tablets and small windows have room for the full labels but not for the
// desktop padding as well -- without this the control group still wrapped to
// a third row at 768px.
const SNUG_QUERY = '(max-width: 900px)';

const LINK_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

interface RoomHeaderProps {
  roomCode: string;
  teamName?: string;
  onRename?: (teamName: string) => Promise<void>;
  avatarUrl?: string;
  onEditAvatar?: () => void;
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
  // The player's achievements, where the room service keeps them. Without
  // this the avatar has no menu and opens the editor directly.
  achievements?: { unlocked: number; total: number; onOpen: () => void; onReset?: () => void };
  // The Arcade, likewise only where the room service runs it. Open between
  // rounds; the balance shows once there is one, and `alert` names what's
  // waiting (a challenge, your move).
  arcade?: { coins: number; available: boolean; alert?: string; onOpen: () => void };
  // Reports the header's rendered height so overlays positioned beneath it
  // (WeaponTipBanner) can sit below wherever it actually ends. It wraps to
  // several rows on a narrow screen, so a fixed offset lands mid-header.
  onHeightChange?: (height: number) => void;
}

// Top bar in three zones. Left: you (your avatar opens your own menu), the
// room code and team name. Right: the things to play with -- the weapon,
// GTA Mode and the Arcade -- then the room's settings behind ⚙. Settings
// used once a session (deck, theme, role, leaving) live in the menu, so the
// header stays one calm row on every screen.
export default function RoomHeader({
  avatarUrl, onEditAvatar, roomCode, teamName, onRename, copied, onCopy, isCreator,
  theme, onToggleTheme, isObserver, deck, onSwitchDeck, equippedWeaponId, onCancelTargeting, onOpenWeaponTray,
  isRevealed, isDriving, onStartDriving,
  onSwitchRole, onLeave, achievements, arcade, onHeightChange,
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
  const control = touchPrimary || narrow ? 44 : 36;
  // Only once the round's votes are revealed -- a fun beat between reveal
  // and starting the next round, not a mid-vote distraction. Never on a
  // touch-only device: driving needs a physical keyboard.
  const canDrive = !isObserver && isRevealed && !touchPrimary;
  const weaponLabel = WEAPONS.find(w => w.id === equippedWeaponId)?.label;

  const avatar = <img src={avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full" />;
  // Your own things: the avatar, achievements and coins. Where the room
  // service keeps no progress, the avatar opens the editor directly.
  const you = achievements ? (
    <RoomMenu
      label="You"
      round
      size={44}
      // On a phone the ▾ sits on the avatar as a badge, to leave the team name room.
      trigger={narrow
        ? <span className="relative">{avatar}<span aria-hidden="true" className="absolute -right-1 -bottom-1 rounded-full bg-sp-panel px-0.5 text-[9px] leading-none text-sp-text">▾</span></span>
        : <>{avatar}<span aria-hidden="true" className="mr-1 text-[10px]">▾</span></>}
      summary={arcade && arcade.coins > 0 ? <span><span aria-hidden="true">🪙</span> {arcade.coins} coins</span> : undefined}
      items={[
        ...(onEditAvatar ? [{ label: 'Edit avatar', onSelect: onEditAvatar }] : []),
        { label: '🏆 Achievements', detail: `${achievements.unlocked} of ${achievements.total}`, onSelect: achievements.onOpen },
        ...(achievements.onReset ? [{ label: 'Reset my progress', onSelect: achievements.onReset }] : []),
      ]}
    />
  ) : onEditAvatar && (
    <button onClick={onEditAvatar} aria-label="Customise your avatar" title="Customise your avatar" className="relative h-11 w-11 shrink-0 cursor-pointer rounded-full border border-sp-border-strong bg-sp-card-bg p-1 hover:border-sp-accent">
      <img src={avatarUrl} alt="" className="h-full w-full rounded-full" />
      <span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 rounded-full bg-sp-panel px-1 text-xs text-sp-text">✎</span>
    </button>
  );

  const room = (
    <RoomMenu
      size={control}
      groups={isCreator ? [{
        heading: 'Deck',
        items: DECK_ORDER.map(id => ({ label: DECKS[id].name, selected: id === deck.id, onSelect: () => onSwitchDeck(id) })),
      }] : []}
      items={[
        // On a phone GTA Mode has no room in the header.
        ...(narrow && canDrive ? [{ label: '🚗 GTA Mode', onSelect: onStartDriving }] : []),
        { label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', onSelect: onToggleTheme },
        isObserver
          ? { label: 'Switch to voting', onSelect: () => onSwitchRole(false), accent: true }
          : { label: 'Switch to observing', onSelect: () => onSwitchRole(true), accent: true },
        { label: 'Leave room', onSelect: onLeave },
      ]}
    />
  );

  // The weapon is tied to what you're doing right now and turns into
  // "Cancel" mid-throw, so it's never hidden. Not while driving: the tray is
  // a full-screen scrim over a live physics loop that reads the same keys.
  // Cancel stays enabled so anyone already targeting can back out.
  const weapon = equippedWeaponId ? (
    <button
      onClick={onCancelTargeting}
      aria-label={narrow ? `Cancel throwing ${weaponLabel}` : undefined}
      className="min-h-[36px] cursor-pointer whitespace-nowrap rounded-md border border-sp-accent-border bg-sp-accent-panel-2 px-3 font-sp-font text-xs font-bold text-sp-accent-text"
      style={{ minHeight: control }}
    >{narrow ? 'Cancel' : `Cancel throwing ${weaponLabel}`}</button>
  ) : (
    <button
      onClick={onOpenWeaponTray}
      disabled={isDriving}
      title={isDriving ? 'Not available while driving' : undefined}
      aria-label={narrow ? (isDriving ? 'Choose Your Weapon (unavailable while driving)' : 'Choose Your Weapon') : undefined}
      style={narrow ? { width: control, height: control } : { minHeight: control }}
      className={`flex items-center justify-center whitespace-nowrap rounded-md border-none font-sp-font text-xs font-bold ${narrow ? 'text-base' : 'px-3.5'} ${
        isDriving ? 'cursor-default bg-sp-panel-2 text-sp-text-faint opacity-50' : 'cursor-pointer bg-sp-accent text-sp-bg'
      }`}
    >{narrow ? '🎯' : '🎯 Choose Your Weapon'}</button>
  );

  return (
    <div
      ref={headerRef}
      className={`sp-room-header flex flex-wrap items-center justify-between border-b border-sp-border ${narrow ? 'gap-2 px-3 py-2.5' : snug ? 'gap-3 px-4 py-3' : 'gap-5 px-7 py-4'}`}
    >
      {/* nowrap: the room code must stay on the row it aligns with. */}
      <div className={`flex min-w-0 flex-1 flex-nowrap items-center ${narrow ? 'gap-2' : 'gap-4'}`}>
        {you}
        {/* Purely decorative, and the first thing worth spending to keep the
            room code on one line with the controls beside it. */}
        {!narrow && <img src={`${import.meta.env.BASE_URL}favicon.svg?v=2`} alt="" width="22" height="22" />}
        <button
          onClick={onCopy}
          title="Copy shareable invite link"
          aria-label={`Room ${roomCode.split('').join(' ')}. Copy shareable invite link`}
          className={`flex shrink-0 min-h-[44px] cursor-pointer items-center rounded-md border border-sp-border bg-sp-panel px-2.5 text-sp-text-dim ${narrow || touchPrimary ? 'gap-2' : 'gap-[7px] py-1.5'}`}
        >
          <span aria-hidden="true" className="font-sp-mono text-[13px] tracking-[0.08em]">{roomCode}</span>
          {narrow
            ? <span aria-hidden="true" className="text-[12px] text-sp-text-faint">{copied ? '✓' : LINK_ICON}</span>
            : <span aria-hidden="true" className="text-[11px] text-sp-text-faint">{copied ? 'link copied' : 'copy link'}</span>}
        </button>
        {/* Only the name yields space; the code and tap targets stay intact. */}
        {isCreator && onRename ? <TeamNameEditor teamName={teamName} onSave={onRename} compact={narrow} />
          : teamName && <span title={teamName} className="min-w-0 max-w-56 truncate text-sm font-semibold text-sp-text">{teamName}</span>}
        {/* Announced separately from the button label so the confirmation is
            read out on click -- a label change alone isn't reliably announced. */}
        <span aria-live="polite" className="sr-only">{copied ? 'Invite link copied to clipboard' : ''}</span>
      </div>

      <div className={`flex items-center ${narrow ? 'gap-2' : 'gap-3'}`}>
        {weapon}
        {!narrow && canDrive && (
          <button
            onClick={onStartDriving}
            disabled={isDriving}
            style={{ minHeight: control }}
            className={`whitespace-nowrap rounded-md border-none px-3.5 font-sp-font text-xs font-bold ${
              isDriving ? 'cursor-default bg-sp-panel-2 text-sp-text-faint opacity-50' : 'cursor-pointer bg-sp-accent text-sp-bg'
            }`}
          >🚗 GTA Mode</button>
        )}
        {arcade && <ArcadeButton {...arcade} compact={narrow} size={control} />}
        {room}
      </div>
    </div>
  );
}

// The Arcade's door: dim until the votes are revealed, with your balance
// once there is one, and a dot (with two beats of pulse) when a challenge or
// your move is waiting.
function ArcadeButton({ coins, available, alert, onOpen, compact, size }: NonNullable<RoomHeaderProps['arcade']> & { compact: boolean; size: number }) {
  const name = !available ? 'Arcade, opens after the reveal' : ['Arcade', alert, coins > 0 ? `${coins} coins` : undefined].filter(Boolean).join(', ');
  return (
    <button
      onClick={() => { if (available) onOpen(); }}
      aria-disabled={!available}
      aria-label={name}
      title={available ? undefined : 'Opens after the reveal'}
      data-alert={available && !!alert}
      style={compact ? { width: size, height: size } : { minHeight: size }}
      className={`sp-arcade-door relative flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-sp-font text-xs font-bold ${compact ? '' : 'px-3'} ${
        available ? 'cursor-pointer border-sp-accent-border bg-sp-accent-panel text-sp-text' : 'cursor-default border-sp-border bg-sp-panel-2 text-sp-text-faint'
      }`}
    >
      <span aria-hidden="true" className={compact ? 'text-base' : ''}>🕹</span>
      {!compact && <span aria-hidden="true">Arcade</span>}
      {!compact && coins > 0 && <span aria-hidden="true" className="rounded-full bg-sp-panel px-1.5 py-0.5 tabular-nums">🪙 {coins}</span>}
      {available && alert && <span aria-hidden="true" className="sp-arcade-door-dot" />}
    </button>
  );
}
