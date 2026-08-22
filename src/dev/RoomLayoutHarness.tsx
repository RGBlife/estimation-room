import { useCallback, useRef, useState } from 'react';
import SeatTable from '../features/room/SeatTable.tsx';
import VotingBar from '../features/room/VotingBar.tsx';
import RoomHeader from '../features/room/RoomHeader.tsx';
import Toast from '../features/room/Toast.tsx';
import WeaponTray from '../features/room/WeaponTray.tsx';
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
  // Real weapon/driving state rather than no-op stubs, so the interaction
  // between the two (see RoomScreen.handleStartDriving) can actually be
  // exercised here instead of only reasoned about.
  const [isDriving, setIsDriving] = useState(false);
  const [equippedWeaponId, setEquippedWeaponId] = useState<string | null>(null);
  const [weaponTrayOpen, setWeaponTrayOpen] = useState(false);
  const cancelTargeting = useCallback(() => setEquippedWeaponId(null), []);
  // Mirrors RoomScreen: starting a drive drops any equipped weapon.
  const handleStartDriving = useCallback(() => {
    cancelTargeting();
    setIsDriving(true);
  }, [cancelTargeting]);

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
        isCreator={params.get('host') !== '0'}
        theme="dark"
        onToggleTheme={() => {}}
        isObserver={false}
        deck={deck}
        onSwitchDeck={setDeckId}
        equippedWeaponId={equippedWeaponId}
        onCancelTargeting={cancelTargeting}
        onOpenWeaponTray={() => setWeaponTrayOpen(true)}
        isRevealed={revealed}
        isDriving={isDriving}
        onStartDriving={handleStartDriving}
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
        {/* Equips directly, bypassing the tray -- lets a test set up the
            "already targeting, then start driving" order of events. */}
        <button
          data-testid="equip-weapon"
          onClick={() => setEquippedWeaponId(id => (id ? null : 'paper-airplane'))}
          className="cursor-pointer rounded border border-sp-border-strong bg-sp-panel-2 px-2 py-1 text-[11px] text-sp-text-dim"
        >{equippedWeaponId ? 'Unequip' : 'Equip weapon'}</button>
        <span data-testid="drive-state" className="font-sp-mono text-[11px] text-sp-text-faint">
          driving:{isDriving ? 'yes' : 'no'} weapon:{equippedWeaponId ?? 'none'}
        </span>
        {isDriving && (
          <button
            data-testid="stop-drive"
            onClick={() => setIsDriving(false)}
            className="cursor-pointer rounded border border-sp-border-strong bg-sp-panel-2 px-2 py-1 text-[11px] text-sp-text-dim"
          >Stop drive</button>
        )}
      </div>

      <Toast
        message="Deck switched to Powers of 2 — everyone's vote was reset"
        rendered={toastOpen}
        closing={false}
        bottom={(votingBarHeight || 96) + 12}
      />

      <WeaponTray
        open={weaponTrayOpen}
        selectedWeaponId={equippedWeaponId}
        onSelect={id => { setEquippedWeaponId(id); setWeaponTrayOpen(false); }}
        onClose={() => setWeaponTrayOpen(false)}
      />

      <SeatTable
        participants={participants}
        uid="p0"
        isRevealed={revealed}
        anyVote
        allVoted
        onReveal={() => setRevealed(true)}
        canTarget={!!equippedWeaponId}
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
