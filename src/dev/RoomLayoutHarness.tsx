import { useCallback, useRef, useState } from 'react';
import SeatTable from '../features/room/SeatTable.tsx';
import VotingBar from '../features/room/VotingBar.tsx';
import RoomHeader from '../features/room/RoomHeader.tsx';
import Toast from '../features/room/Toast.tsx';
import { DECKS, ALL_DECK_IDS } from '../features/room/decks.ts';
import { computeStats, computeDistribution, computeCustomGroups } from '../features/room/stats.ts';
import { randomAvatar } from '../features/avatar/index.js';
import type { Participant, DeckId } from '../types/room.ts';

// Dev-only, Firestore-free stage for the *whole room layout* -- header, seats,
// table and voting bar composed the way RoomScreen composes them, but with
// fixture participants and no network. The existing ?visual-test=cards harness
// mounts VotingBar alone, which can't catch the layout problems that only
// appear when all four are on screen together (a header wrapping into a tower,
// seat rows overflowing, overlays landing inside the voting bar).
//
// Reached via ?visual-test=room&seats=N, stripped from production builds by
// the same import.meta.env.DEV gate used elsewhere.

const VOTE_VALUES = DECKS.fibonacci.values!.map(v => v.value);

function fixtureParticipants(seats: number, observers: number): Record<string, Participant> {
  const out: Record<string, Participant> = {};
  for (let i = 0; i < seats + observers; i++) {
    const isObserver = i >= seats;
    out[`p${i}`] = {
      name: `Player ${i + 1}`,
      avatar: randomAvatar(),
      joinedAt: i,
      isObserver,
      vote: isObserver ? null : VOTE_VALUES[i % VOTE_VALUES.length],
    };
  }
  return out;
}

const ZERO_MOVE = { x: 0, y: 0, rot: 0 };

export default function RoomLayoutHarness() {
  const params = new URLSearchParams(window.location.search);
  const seats = Number(params.get('seats') || 8);
  const observers = Number(params.get('observers') || 0);
  const [deckId, setDeckId] = useState<DeckId>((params.get('deck') as DeckId) || ALL_DECK_IDS[0]);
  const [revealed, setRevealed] = useState(params.get('revealed') === '1');
  const [toastOpen, setToastOpen] = useState(false);
  const [votingBarHeight, setVotingBarHeight] = useState(0);

  const deck = DECKS[deckId];
  const participants = fixtureParticipants(seats, observers);
  const stats = computeStats(participants, deck);
  const distribution = revealed && deck.resultKind !== 'freeText' ? computeDistribution(participants, deck) : [];
  const customGroups = revealed && deck.resultKind === 'freeText' ? computeCustomGroups(participants) : [];

  const seatNodesRef = useRef(new Map<string, HTMLElement>());
  const stageNodeRef = useRef<HTMLDivElement>(null);
  const registerSeatNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) seatNodesRef.current.set(id, node);
    else seatNodesRef.current.delete(id);
  }, []);
  const getSeatNode = useCallback((id: string) => seatNodesRef.current.get(id) ?? null, []);
  const handleVotingBarHeightChange = useCallback((h: number) => setVotingBarHeight(h), []);

  return (
    <div className="sp-app">
      <RoomHeader
        roomCode="ABCD"
        copied={false}
        onCopy={() => {}}
        isCreator
        theme="dark"
        onToggleTheme={() => {}}
        isObserver={false}
        deck={deck}
        onSwitchDeck={setDeckId}
        equippedWeaponId={null}
        onCancelTargeting={() => {}}
        onOpenWeaponTray={() => {}}
        isRevealed={revealed}
        isDriving={false}
        onStartDriving={() => {}}
        onSwitchRole={() => {}}
        onLeave={() => {}}
      />

      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          data-testid="toggle-reveal"
          onClick={() => setRevealed(r => !r)}
          className="cursor-pointer rounded border border-sp-border-strong bg-sp-panel-2 px-2 py-1 text-[11px] text-sp-text-dim"
        >{revealed ? 'Show voting' : 'Show revealed'}</button>
        <button
          data-testid="toggle-toast"
          onClick={() => setToastOpen(t => !t)}
          className="cursor-pointer rounded border border-sp-border-strong bg-sp-panel-2 px-2 py-1 text-[11px] text-sp-text-dim"
        >Toggle toast</button>
      </div>

      <Toast
        message="Deck switched to Powers of 2 — everyone's vote was reset"
        rendered={toastOpen}
        closing={false}
        bottom={(votingBarHeight || 96) + 12}
      />

      <SeatTable
        participants={participants}
        uid="p0"
        isRevealed={revealed}
        anyVote
        allVoted
        onReveal={() => setRevealed(true)}
        canTarget={false}
        onThrowAt={() => {}}
        registerSeatNode={registerSeatNode}
        getSeatNode={getSeatNode}
        stageRef={stageNodeRef}
        throws={[]}
        onThrowDone={() => {}}
        bottomClearance={votingBarHeight}
        isDriving={false}
        forceEndDrive={false}
        drivers={{}}
        tableCracks={[]}
        tablePieceMove={{ left: ZERO_MOVE, right: ZERO_MOVE }}
        tableWasted={{}}
        onPublishDrive={() => {}}
        onExitDrive={() => {}}
        onPublishCrack={() => {}}
        onPublishPieceMove={() => {}}
        onMarkWasted={() => {}}
      />

      <VotingBar
        deck={deck}
        isObserver={false}
        myVote={VOTE_VALUES[0]}
        isRevealed={revealed}
        onSelect={() => {}}
        onJoinVoting={() => {}}
        distribution={distribution}
        customGroups={customGroups}
        hasAverage={stats.hasAverage}
        average={stats.average}
        isWideSpread={stats.isWideSpread}
        mode={stats.mode}
        modeIsTie={stats.modeIsTie}
        flaggedCount={stats.flaggedCount}
        onStartNextRound={() => setRevealed(false)}
        hoveredValue={null}
        onHoverValue={() => {}}
        onHeightChange={handleVotingBarHeightChange}
      />
    </div>
  );
}
