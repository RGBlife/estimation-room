import { useCallback, useRef, useState } from 'react';
import SeatTable from './SeatTable.tsx';
import VotingBar from './VotingBar.tsx';
import WeaponTray from './WeaponTray.tsx';
import RoomHeader from './RoomHeader.tsx';
import WeaponTipBanner from './WeaponTipBanner.tsx';
import Toast from './Toast.tsx';
import { useKeyboardShortcuts } from './useKeyboardShortcuts.ts';
import { useStoryDraft } from './useStoryDraft.ts';
import { useWeaponTargeting } from './useWeaponTargeting.ts';
import { useDeckSwitchToast } from './useDeckSwitchToast.ts';
import { FAKE_PARTICIPANTS } from './useDevFakeParticipants.ts';
import { computeStats, computeDistribution, computeCustomGroups } from './stats.ts';
import { DECKS, DEFAULT_DECK } from './decks.ts';
import type { RoomDoc, Participant, CardValue, DeckId } from '../../types/room.ts';
import type { ThrowEvent } from '../../types/throws.ts';
import type { Theme } from '../../shared/lib/theme.ts';

interface RoomActions {
  setRole: (isObserver: boolean) => Promise<void>;
  castVote: (value: CardValue) => Promise<void>;
  setStory: (story: string) => Promise<void>;
  setDeck: (deckId: DeckId) => Promise<void>;
  reveal: () => Promise<void>;
  startNextRound: () => Promise<void>;
  leave: () => Promise<void>;
  throwWeapon: (targetUid: string, weaponId: string, offsetX?: number, offsetY?: number) => Promise<void>;
  dismissThrow: (throwId: string) => void;
}

interface RoomScreenProps {
  room: RoomDoc;
  roomCode: string;
  uid: string | null;
  throws: ThrowEvent[];
  actions: RoomActions;
  theme: Theme;
  onToggleTheme: () => void;
}

export default function RoomScreen({ room, roomCode, uid, throws, actions, theme, onToggleTheme }: RoomScreenProps) {
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hoveredVoteValue, setHoveredVoteValue] = useState<CardValue | null>(null);
  const [votingBarHeight, setVotingBarHeight] = useState(0);
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

  const { storyDraft, storyInputRef, handleStoryChange } = useStoryDraft(room.story, (story) => {
    runAction(() => actions.setStory(story), "The story title didn't save — check your connection.");
  });

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
        storyDraft={storyDraft}
        storyInputRef={storyInputRef}
        onStoryChange={handleStoryChange}
        story={room.story}
        theme={theme}
        onToggleTheme={onToggleTheme}
        isObserver={isObserver}
        deck={deck}
        onSwitchDeck={handleSwitchDeck}
        equippedWeaponId={equippedWeaponId}
        onCancelTargeting={cancelTargeting}
        onOpenWeaponTray={openTray}
        onSwitchRole={(nextIsObserver) => runAction(() => actions.setRole(nextIsObserver), "Couldn't switch role — check your connection.")}
        onLeave={actions.leave}
      />

      <Toast message={deckToastMessage} rendered={deckToastRendered} closing={deckToastClosing} />

      <WeaponTipBanner
        equippedWeaponId={equippedWeaponId}
        rendered={weaponTipRendered}
        closing={weaponTipClosing}
        onDismiss={dismissWeaponTip}
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
      />

      {actionError && (
        <div className="pointer-events-none fixed right-0 bottom-[92px] left-0 flex justify-center">
          <div className="rounded-lg border border-sp-warn-border bg-sp-warn-bg px-3.5 py-1.5 text-sm font-semibold text-sp-warn-text">{actionError}</div>
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
