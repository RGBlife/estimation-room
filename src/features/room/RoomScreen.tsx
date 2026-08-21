import { useCallback, useEffect, useRef, useState } from 'react';
import SeatTable from './SeatTable.tsx';
import VotingBar from './VotingBar.tsx';
import WeaponTray from './WeaponTray.tsx';
import RoomHeader from './RoomHeader.tsx';
import WeaponTipBanner from './WeaponTipBanner.tsx';
import Toast from './Toast.tsx';
import { useKeyboardShortcuts } from './useKeyboardShortcuts.ts';
import { useWeaponTargeting } from './useWeaponTargeting.ts';
import { useDeckSwitchToast } from './useDeckSwitchToast.ts';
import { FAKE_PARTICIPANTS } from './useDevFakeParticipants.ts';
import { computeStats, computeDistribution, computeCustomGroups } from './stats.ts';
import { DECKS, DEFAULT_DECK } from './decks.ts';
import type { RoomDoc, Participant, CardValue, DeckId } from '../../types/room.ts';
import type { ThrowEvent } from '../../types/throws.ts';
import type { DriverState, TableCrackEvent, TablePieceMove, WastedMap } from '../../types/gta.ts';
import type { Theme } from '../../shared/lib/theme.ts';

// Used only until the voting bar / header have reported their real measured
// heights (the very first paint), so overlays don't flash at the wrong offset.
const VOTING_BAR_FALLBACK = 96;
const HEADER_FALLBACK = 64;
// Breathing room between a floating overlay and the bar/header it clears.
const OVERLAY_GAP = 12;

interface RoomActions {
  setRole: (isObserver: boolean) => Promise<void>;
  castVote: (value: CardValue) => Promise<void>;
  setDeck: (deckId: DeckId) => Promise<void>;
  reveal: () => Promise<void>;
  startNextRound: () => Promise<void>;
  leave: () => Promise<void>;
  throwWeapon: (targetUid: string, weaponId: string, offsetX?: number, offsetY?: number) => Promise<void>;
  dismissThrow: (throwId: string) => void;
  startDrive: () => void;
  publishDrive: (state: Omit<DriverState, 'uid'>) => void;
  stopDrive: () => void;
  publishCrack: (crack: Omit<TableCrackEvent, 'id' | 'fromUid' | 'ts'>) => void;
  publishPieceMove: (side: 'left' | 'right', move: TablePieceMove) => void;
  markPlayerWasted: (targetUid: string) => void;
  resetTable: () => void;
}

interface RoomScreenProps {
  room: RoomDoc;
  roomCode: string;
  uid: string | null;
  throws: ThrowEvent[];
  drivers: Record<string, DriverState>;
  tableCracks: TableCrackEvent[];
  tablePieceMove: { left: TablePieceMove; right: TablePieceMove };
  tableWasted: WastedMap;
  actions: RoomActions;
  theme: Theme;
  onToggleTheme: () => void;
}

export default function RoomScreen({
  room, roomCode, uid, throws, drivers, tableCracks, tablePieceMove, tableWasted, actions, theme, onToggleTheme,
}: RoomScreenProps) {
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hoveredVoteValue, setHoveredVoteValue] = useState<CardValue | null>(null);
  const [votingBarHeight, setVotingBarHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isDriving, setIsDriving] = useState(false);
  const participants: Record<string, Participant> = FAKE_PARTICIPANTS
    ? { ...FAKE_PARTICIPANTS, ...room.participants }
    : room.participants;
  const me = participants[uid ?? ''] || ({} as Partial<Participant>);
  const isCreator = room.creatorId === uid;
  const isObserver = !!me.isObserver;
  const isRevealed = room.isRevealed;
  const deck = DECKS[room.deck ?? DEFAULT_DECK];

  // uid -> DOM node, covers both active seats and the observer rail — a
  // single lookup used by ThrowOverlay to compute fly-to animation geometry.
  const seatNodesRef = useRef(new Map<string, HTMLElement>());
  const stageNodeRef = useRef<HTMLDivElement>(null);
  const registerSeatNode = useCallback((seatUid: string, node: HTMLElement | null) => {
    if (node) seatNodesRef.current.set(seatUid, node);
    else seatNodesRef.current.delete(seatUid);
  }, []);
  const getSeatNode = useCallback((seatUid: string) => seatNodesRef.current.get(seatUid) ?? null, []);
  const handleVotingBarHeightChange = useCallback((h: number) => setVotingBarHeight(h), []);
  const handleHeaderHeightChange = useCallback((h: number) => setHeaderHeight(h), []);
  // Overlays pinned near the bottom clear the voting bar by measuring it
  // rather than assuming a one-row bar -- on a phone it wraps to two or three
  // rows (and taller again once the distribution panel renders), which used to
  // leave these rendering inside it.
  const aboveBar = (votingBarHeight || VOTING_BAR_FALLBACK) + OVERLAY_GAP;

  const runAction = useCallback((fn: () => Promise<void>, failureMessage: string) => {
    setActionError(null);
    fn().catch(() => setActionError(failureMessage));
  }, []);

  const handleCastVote = useCallback((value: CardValue) => {
    runAction(() => actions.castVote(value), "Your vote didn't save — check your connection and try again.");
  }, [runAction, actions]);

  const handleReveal = useCallback(() => {
    runAction(actions.reveal, "Couldn't reveal votes — try again.");
  }, [runAction, actions]);

  const handleStartNextRound = useCallback(() => {
    runAction(actions.startNextRound, "Couldn't start the next round — try again.");
  }, [runAction, actions]);

  const {
    weaponTrayOpen, equippedWeaponId, weaponTipRendered, weaponTipClosing,
    openTray, closeTray, selectWeapon, cancelTargeting, dismissWeaponTip, throwAt,
  } = useWeaponTargeting();

  const { message: deckToastMessage, rendered: deckToastRendered, closing: deckToastClosing, show: showDeckToast } = useDeckSwitchToast();

  const { anyVote, allVoted, hasAverage, average, isWideSpread, mode, modeIsTie, flaggedCount } = computeStats(participants, deck);
  const distribution = isRevealed && deck.resultKind !== 'freeText' ? computeDistribution(participants, deck) : [];
  const customGroups = isRevealed && deck.resultKind === 'freeText' ? computeCustomGroups(participants) : [];
  // Seats only dim while actively hovering a bar in the distribution panel —
  // no highlight is shown by default, so the table stays at full brightness
  // until the user is inspecting a specific vote group.
  const highlightValues = hoveredVoteValue != null ? [hoveredVoteValue] : [];

  useKeyboardShortcuts({
    isRevealed, allVoted, anyVote, isObserver,
    deckValues: deck.values?.map((v) => v.value) ?? null,
    onReveal: handleReveal, onStartNextRound: handleStartNextRound, onCastVote: handleCastVote,
  });

  const handleSwitchDeck = useCallback((deckId: DeckId) => {
    setActionError(null);
    actions.setDeck(deckId)
      .then(() => showDeckToast(`Deck switched to ${DECKS[deckId].name} — everyone's vote was reset`))
      .catch(() => setActionError("Couldn't switch deck — try again."));
  }, [actions, showDeckToast]);

  const handleThrowAt = (targetUid: string, event?: React.MouseEvent) => {
    throwAt(targetUid, event, (target, weaponId, offsetX, offsetY) => {
      runAction(() => actions.throwWeapon(target, weaponId, offsetX, offsetY), "Couldn't throw — check your connection.");
    });
  };

  // A new round hides votes again, and GTA Mode was gated on isRevealed --
  // starting the next round should end any drive in progress, but gracefully:
  // GtaOverlay's forceEnd sends an actively-driving car through its normal
  // explosion/return sequence instead of yanking the car out from under the
  // driver. isDriving itself only clears once that sequence finishes and
  // GtaOverlay calls onExit (handleExitDrive) -- not the instant the round
  // resets, or the animation never gets to play.
  const forceEndDrive = isDriving && !isRevealed;

  // Cracks/wasted/piece-shove all live under gtaTable/$roomCode and persist
  // for the round, same as votes -- clear them on the same isRevealed
  // true->false transition that resets everyone's vote. resetTableDamage is
  // a remove(), so every client's independent call here is a harmless no-op
  // after the first one lands (see resetTableDamage in roomStore.gta.ts).
  const wasRevealedRef = useRef(isRevealed);
  useEffect(() => {
    if (wasRevealedRef.current && !isRevealed) actions.resetTable();
    wasRevealedRef.current = isRevealed;
  }, [isRevealed, actions]);

  const handleStartDriving = useCallback(() => {
    actions.startDrive();
    setIsDriving(true);
  }, [actions]);

  const handleExitDrive = useCallback(() => {
    actions.stopDrive();
    setIsDriving(false);
  }, [actions]);

  const handleCopy = () => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('room', roomCode);
    const text = url.toString();
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      <RoomHeader
        roomCode={roomCode}
        copied={copied}
        onCopy={handleCopy}
        isCreator={isCreator}
        theme={theme}
        onToggleTheme={onToggleTheme}
        isObserver={isObserver}
        deck={deck}
        onSwitchDeck={handleSwitchDeck}
        equippedWeaponId={equippedWeaponId}
        onCancelTargeting={cancelTargeting}
        onOpenWeaponTray={openTray}
        isRevealed={isRevealed}
        isDriving={isDriving}
        onStartDriving={handleStartDriving}
        onSwitchRole={(nextIsObserver) => runAction(() => actions.setRole(nextIsObserver), "Couldn't switch role — check your connection.")}
        onLeave={actions.leave}
        onHeightChange={handleHeaderHeightChange}
      />

      <Toast message={deckToastMessage} rendered={deckToastRendered} closing={deckToastClosing} bottom={aboveBar} />

      <WeaponTipBanner
        equippedWeaponId={equippedWeaponId}
        rendered={weaponTipRendered}
        closing={weaponTipClosing}
        onDismiss={dismissWeaponTip}
        top={(headerHeight || HEADER_FALLBACK) + OVERLAY_GAP}
      />

      <WeaponTray open={weaponTrayOpen} selectedWeaponId={equippedWeaponId} onSelect={selectWeapon} onClose={closeTray} />

      <SeatTable
        participants={participants}
        uid={uid}
        isRevealed={isRevealed}
        anyVote={anyVote}
        allVoted={allVoted}
        onReveal={handleReveal}
        canTarget={!!equippedWeaponId}
        onThrowAt={handleThrowAt}
        registerSeatNode={registerSeatNode}
        getSeatNode={getSeatNode}
        stageRef={stageNodeRef}
        throws={throws}
        onThrowDone={actions.dismissThrow}
        highlightValues={highlightValues}
        bottomClearance={votingBarHeight}
        isDriving={isDriving}
        forceEndDrive={forceEndDrive}
        drivers={drivers}
        tableCracks={tableCracks}
        tablePieceMove={tablePieceMove}
        tableWasted={tableWasted}
        onPublishDrive={actions.publishDrive}
        onExitDrive={handleExitDrive}
        onPublishCrack={actions.publishCrack}
        onPublishPieceMove={actions.publishPieceMove}
        onMarkWasted={actions.markPlayerWasted}
      />

      {actionError && (
        <div className="pointer-events-none fixed right-0 left-0 flex justify-center px-4" style={{ bottom: aboveBar }}>
          <div className="max-w-full rounded-lg border border-sp-warn-border bg-sp-warn-bg px-3.5 py-1.5 text-center text-sm font-semibold text-sp-warn-text">{actionError}</div>
        </div>
      )}

      <VotingBar
        deck={deck}
        isObserver={isObserver}
        myVote={me.vote ?? null}
        isRevealed={isRevealed}
        onSelect={handleCastVote}
        onJoinVoting={() => runAction(() => actions.setRole(false), "Couldn't switch role — check your connection.")}
        distribution={distribution}
        customGroups={customGroups}
        hasAverage={hasAverage}
        average={average}
        isWideSpread={isWideSpread}
        mode={mode}
        modeIsTie={modeIsTie}
        flaggedCount={flaggedCount}
        onStartNextRound={handleStartNextRound}
        hoveredValue={hoveredVoteValue}
        onHoverValue={setHoveredVoteValue}
        onHeightChange={handleVotingBarHeightChange}
      />
    </>
  );
}
