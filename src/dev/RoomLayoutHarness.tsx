import RoomAvatarEditor from '../features/room/RoomAvatarEditor.tsx';
import { participantAvatarSrc } from '../features/avatar/index.js';
import type { AvatarOptions } from '../types/room.ts';
import { loadTheme, saveTheme, type Theme } from '../shared/lib/theme.ts';
import { useCallback, useMemo, useRef, useState } from 'react';
import SeatTable from '../features/room/SeatTable.tsx';
import VotingBar from '../features/room/VotingBar.tsx';
import RoomHeader from '../features/room/RoomHeader.tsx';
import Toast from '../features/room/Toast.tsx';
import WeaponTray from '../features/room/WeaponTray.tsx';
import { setFlightTimeScale } from '../features/room/flightTimeScale.ts';
import { DECKS, ALL_DECK_IDS } from '../features/room/decks.ts';
import { computeStats, computeDistribution, computeCustomGroups } from '../features/room/stats.ts';
import { randomAvatar } from '../features/avatar/index.js';
import type { Participant, DeckId } from '../types/room.ts';
import type { DriverState, TableCrackEvent, WastedMap } from '../types/gta.ts';
import type { ThrowEvent } from '../types/throws.ts';

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

function fixtureParticipants(seats: number, observers: number, voted: number): Record<string, Participant> {
  const out: Record<string, Participant> = {};
  for (let i = 0; i < seats + observers; i++) {
    const isObserver = i >= seats;
    out[`p${i}`] = {
      name: `Player ${i + 1}`,
      avatar: randomAvatar(),
      joinedAt: i,
      isObserver,
      vote: isObserver || i >= voted ? null : VOTE_VALUES[i % VOTE_VALUES.length],
    };
  }
  return out;
}

const ZERO_MOVE = { x: 0, y: 0, rot: 0 };

// Deterministic crack positions for `?cracks=N`. Spread across the table
// rather than random so the same URL always produces the same picture --
// these get screenshotted, and a shifting layout makes two captures
// impossible to compare.
function seededCracks(n: number): TableCrackEvent[] {
  // Positions sit near the edges, because that is where real ones land: a car
  // can only ever contact the table's boundary, so handleTableHit clamps every
  // impact to it. Mid-table spots (which an earlier version of this used)
  // produce screenshots that misrepresent the feature -- damage floating in
  // the middle of a surface nothing could have reached.
  const spots: [number, number][] = [
    [0.18, 0.08], [0.52, 0.05], [0.86, 0.14], [0.95, 0.52], [0.82, 0.93],
    [0.46, 0.96], [0.14, 0.88], [0.05, 0.46], [0.68, 0.06], [0.3, 0.94],
  ];
  return Array.from({ length: Math.min(n, spots.length) }, (_, i) => ({
    id: `seed${i}`,
    fx: spots[i][0],
    fy: spots[i][1],
    rot: (i * 67) % 360,
    side: 'table' as const,
    fromUid: 'p0',
    ts: Date.now() + i,
  }));
}

// Stand-in remote drivers for `?remotecars=N`, so several cars on the board at
// once can be seen without a second browser and a real room.
function seededDrivers(n: number): Record<string, DriverState> {
  const spots: [number, number, number][] = [
    [0.24, 0.28, 0.4], [0.74, 0.34, 3.1], [0.34, 0.52, 1.6], [0.68, 0.58, 2.2],
  ];
  const out: Record<string, DriverState> = {};
  for (let i = 0; i < Math.min(n, spots.length); i++) {
    const [x, y, r] = spots[i];
    // p1 is the local user's own seat, so remote drivers start at p2.
    out[`p${i + 1}`] = { uid: `p${i + 1}`, x, y, r, t: Date.now(), phase: 'driving' };
  }
  return out;
}

export default function RoomLayoutHarness() {
  const params = new URLSearchParams(window.location.search);
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.getAttribute('data-theme') as Theme) || loadTheme());
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    saveTheme(next);
    setTheme(next);
  };
  const seats = Number(params.get('seats') || 8);
  const observers = Number(params.get('observers') || 0);
  const voted = Number(params.get('voted') ?? seats);
  const [nudgedName, setNudgedName] = useState<string | null>(null);
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
  // Crack/wasted state kept locally so the table can actually accumulate
  // damage and split here, exactly as it does against a real room.
  //
  // `?cracks=N` seeds N of them up front. Reaching the 5-crack split threshold
  // by actually ramming is a matter of luck with the car physics, which makes
  // the split -- the most geometry-sensitive thing GTA Mode does -- painful to
  // look at deliberately. Seeded cracks are the same TableCrackEvent shape the
  // real path publishes, so what renders is what a real room renders.
  const [tableCracks, setTableCracks] = useState<TableCrackEvent[]>(() =>
    seededCracks(Number(params.get('cracks') || 0)),
  );
  const [tableWasted, setTableWasted] = useState<WastedMap>(() =>
    params.get('wasted') === '1' ? ({ p2: true } as WastedMap) : {},
  );
  const [throws, setThrows] = useState<ThrowEvent[]>([]);
  const [slowMo, setSlowMo] = useState(1);
  const cancelTargeting = useCallback(() => setEquippedWeaponId(null), []);
  // Mirrors RoomScreen: starting a drive drops any equipped weapon.
  const handleStartDriving = useCallback(() => {
    cancelTargeting();
    setIsDriving(true);
  }, [cancelTargeting]);

  const [editingAvatar, setEditingAvatar] = useState(false);
  const [editedAvatar, setEditedAvatar] = useState<AvatarOptions | null>(null);
  const isObserver = params.get('observer') === '1';
  const myUid = isObserver ? `p${seats}` : (params.get('me') || 'p0');
  const [localVote, setLocalVote] = useState<string | null>(null);
  const deck = DECKS[deckId];
  const participants = useMemo(() => {
    const fixtures = fixtureParticipants(seats, observers, voted);
    if (editedAvatar && fixtures[myUid]) fixtures[myUid] = { ...fixtures[myUid], avatar: editedAvatar };
    if (localVote != null && fixtures[myUid]) fixtures[myUid] = { ...fixtures[myUid], vote: localVote };
    return fixtures;
  }, [seats, observers, voted, editedAvatar, myUid, localVote]);
  const me = participants[myUid];
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
    <div className="sp-app relative">
      {editingAvatar && <RoomAvatarEditor participant={me} onSave={async avatar => setEditedAvatar(avatar)} onClose={() => setEditingAvatar(false)} />}
      <RoomHeader
        avatarUrl={participantAvatarSrc(me)}
        onEditAvatar={() => setEditingAvatar(true)}
        roomCode="ABCD"
        copied={false}
        onCopy={() => {}}
        isCreator={params.get('host') !== '0'}
        theme={theme}
        onToggleTheme={toggleTheme}
        isObserver={isObserver}
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

      {/* The harness's own controls, taken out of flow deliberately. In flow
          they cost ~30px of column height that the real app doesn't have, so
          every vertical-fit assertion measured a stage 30px shorter than the
          one users get -- the harness would report seats behind the results
          panel that are actually fine in production. Overlaid at the top-left
          instead, where they stay clickable without distorting the layout
          under test. */}
      <div className="pointer-events-none absolute top-16 left-0 z-50 flex flex-wrap items-center gap-2 px-3 py-2 [&>*]:pointer-events-auto">
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

      {/* Plane-flight controls, in their own cluster at the bottom-left rather
          than alongside the others at the top. Two more buttons up there wrap
          onto a second row on a phone, and that row lands on top of the room
          menu -- which a test opens, and which real users need. Down here they
          sit clear of both the header and the voting bar. */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-50 flex flex-wrap items-center gap-2 px-3 py-2 [&>*]:pointer-events-auto">
        {/* Throws a paper aeroplane at every seat at once, without having to
            equip and click each one -- the flight is the thing being judged,
            and seeing it run to several targets at different distances and
            angles in one go is how you tell whether the arc holds up.

            Deliberately not labelled "Throw at ...": the real seat targets use
            that phrasing for their aria-labels, and a test counts those to
            check no seat is targetable mid-drive. */}
        <button
          data-testid="throw-all"
          onClick={() => {
            // Everyone but the thrower, observers included -- an observer seat
            // sits in a different part of the layout, so it's a useful target.
            const targets = Object.keys(participants).filter(id => id !== 'p0');
            const stamp = Date.now();
            setThrows(t => [
              ...t,
              ...targets.map((toUid, i) => ({
                id: `demo${stamp}-${i}`,
                fromUid: 'p0',
                toUid,
                weaponId: 'paper-airplane',
                ts: stamp,
                offsetX: 0,
                offsetY: 0,
              })),
            ]);
          }}
          className="cursor-pointer rounded border border-sp-border-strong bg-sp-panel-2 px-2 py-1 text-[11px] text-sp-text-dim"
        >Plane demo</button>
        {/* Slow motion, because at 950ms a hitch is over before you can see
            where it was. Stretches the flight's own duration rather than the
            CSS clock, so what slows down is exactly the per-frame path this
            exists to inspect. */}
        <button
          data-testid="toggle-slowmo"
          onClick={() => {
            const next = slowMo === 1 ? 4 : slowMo === 4 ? 10 : 1;
            setSlowMo(next);
            setFlightTimeScale(next);
          }}
          className="cursor-pointer rounded border border-sp-border-strong bg-sp-panel-2 px-2 py-1 text-[11px] text-sp-text-dim"
        >{slowMo === 1 ? 'Slow-mo: off' : `Slow-mo: ${slowMo}x`}</button>
      </div>

      {nudgedName && <p role="status" className="text-center text-sm text-sp-text-dim">Preview: nudged {nudgedName}</p>}
      <Toast
        message="Deck switched to Powers of 2 — everyone's vote was reset"
        rendered={toastOpen}
        closing={false}
        bottom={(votingBarHeight || 96) + 12}
      />

      <WeaponTray
        isObserver={isObserver}
        open={weaponTrayOpen}
        selectedWeaponId={equippedWeaponId}
        onSelect={id => { setEquippedWeaponId(id); setWeaponTrayOpen(false); }}
        onClose={() => setWeaponTrayOpen(false)}
      />

      <SeatTable
        participants={participants}
        uid={myUid}
        creatorId={params.get('host') !== '0' ? 'p0' : 'p1'}
        isRevealed={revealed}
        anyVote={voted > 0}
        allVoted={voted >= seats}
        onNudge={id => setNudgedName(participants[id].name)}
        onReveal={() => setRevealed(true)}
        canTarget={!!equippedWeaponId}
        // Real throws rather than a no-op: ThrowOverlay's flight/impact math
        // reads the live avatar and stage rects, which are exactly what the
        // responsive sizing changes, so a stubbed throw would have hidden any
        // breakage here.
        onThrowAt={(id, e) => {
          const el = e?.currentTarget as HTMLElement | undefined;
          let offsetX = 0;
          let offsetY = 0;
          if (el && e) {
            const r = el.getBoundingClientRect();
            offsetX = (e.clientX - r.left) / r.width - 0.5;
            offsetY = (e.clientY - r.top) / r.height - 0.5;
          }
          setThrows(t => [...t, {
            id: `t${t.length}`, fromUid: myUid, toUid: id,
            weaponId: equippedWeaponId ?? 'confetti', ts: Date.now(), offsetX, offsetY,
          }]);
        }}
        registerSeatNode={registerSeatNode}
        getSeatNode={getSeatNode}
        stageRef={stageNodeRef}
        throws={throws}
        onThrowDone={id => setThrows(t => t.filter(x => x.id !== id))}
        bottomClearance={votingBarHeight}
        // Real GTA state rather than a hardcoded false. The harness already
        // owned isDriving for the header's benefit, but passed false here, so
        // GtaOverlay never mounted and the button appeared to do nothing --
        // the one feature whose geometry depends on the seat/table sizing this
        // harness exists to exercise could not be exercised in it at all.
        isDriving={isDriving}
        forceEndDrive={false}
        drivers={seededDrivers(Number(params.get('remotecars') || 0))}
        tableCracks={tableCracks}
        tablePieceMove={{ left: ZERO_MOVE, right: ZERO_MOVE }}
        tableWasted={tableWasted}
        onPublishDrive={() => {}}
        onExitDrive={() => setIsDriving(false)}
        onPublishCrack={crack =>
          setTableCracks(cs => [...cs, { ...crack, id: `c${cs.length}`, fromUid: 'p0', ts: Date.now() }])
        }
        onPublishPieceMove={() => {}}
        onMarkWasted={id => setTableWasted(w => ({ ...w, [id]: true }))}
      />

      <VotingBar
        deck={deck}
        isObserver={isObserver}
        myVote={me?.vote ?? null}
        isRevealed={revealed}
        onSelect={setLocalVote}
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
