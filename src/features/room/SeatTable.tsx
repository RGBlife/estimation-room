import { useEffect, useState, type RefObject } from 'react';
import { participantAvatarSrc } from '../avatar/index.js';
import useMediaQuery from '../../shared/hooks/useMediaQuery.ts';
import ObserverRail from './ObserverRail.tsx';
import ThrowOverlay from './ThrowOverlay.tsx';
import type { Participant, CardValue } from '../../types/room.ts';
import type { ThrowEvent } from '../../types/throws.ts';

type ParticipantEntry = [string, Participant];

function byJoinOrder([, a]: ParticipantEntry, [, b]: ParticipantEntry) {
  return (a.joinedAt ?? 0) - (b.joinedAt ?? 0);
}

// Seats sit in wrapping flex rows above and below the table, plus one on each
// table end on wide viewports, so any player count lays out without overlap.
// Two sizing steps: default, and compact once the room gets big — wrapping
// absorbs crowding, so no continuous shrink is needed.
const SEAT_GAP = 8;
const DEFAULT_SIZES = { seatW: 96, avatar: 52, meAvatar: 60, cardW: 34, cardH: 48, cardFont: 16 };
const COMPACT_SIZES = { seatW: 78, avatar: 40, meAvatar: 46, cardW: 26, cardH: 36, cardFont: 12 };
const COMPACT_AT = 17;
const STAGE_MAX_CAP = 1180;
const TABLE_MIN_WIDTH = 200;
const TABLE_MIN_HEIGHT = 170;
const END_SEAT_BREAKPOINT = '(min-width: 640px)';

// A small room (few seats) would otherwise size the table to just fit those
// seats regardless of screen size, leaving it stranded tiny in the middle of
// a big monitor. These floors scale the table up with the viewport so it
// still reads as a table on wide screens, independent of headcount — width
// and height climb together so it stays table-shaped instead of a thin bar.
const WIDTH_FLOOR_BREAKPOINTS = [
  { minWidth: 1600, floor: 620 },
  { minWidth: 1200, floor: 520 },
  { minWidth: 900, floor: 420 },
  { minWidth: 0, floor: 0 },
];
const HEIGHT_BREAKPOINTS = [
  { minWidth: 1600, height: 260 },
  { minWidth: 1200, height: 220 },
  { minWidth: 900, height: 190 },
  { minWidth: 0, height: TABLE_MIN_HEIGHT },
];

function useViewportWidth(): number {
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 0));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

interface SeatSizes {
  seatW: number;
  avatar: number;
  meAvatar: number;
  cardW: number;
  cardH: number;
  cardFont: number;
}

interface SeatData {
  id: string;
  isMe: boolean;
  avatarUrl: string | undefined;
  size: number;
  displayName: string;
  showBlank: boolean;
  showPlaced: boolean;
  showValue: boolean;
  voteValue: CardValue | null;
  flipDelay: number;
  dimmed: boolean;
}

// Index-based so nobody reshuffles when someone joins (new joiners sort last
// by joinedAt). Ends are pinned to indices 2 and 3; everyone else alternates
// bottom/top, keeping the rows balanced within one seat.
function distributeSeats(seats: SeatData[], useEnds: boolean) {
  const top: SeatData[] = [];
  const bottom: SeatData[] = [];
  let leftEnd: SeatData | null = null;
  let rightEnd: SeatData | null = null;
  seats.forEach((seat, idx) => {
    if (useEnds && idx === 2) { leftEnd = seat; return; }
    if (useEnds && idx === 3) { rightEnd = seat; return; }
    (idx % 2 === 0 ? bottom : top).push(seat);
  });
  return { top, bottom, leftEnd, rightEnd };
}

interface SeatProps {
  seat: SeatData;
  reverse?: boolean;
  canTarget: boolean;
  onThrowAt: (id: string, e: React.MouseEvent) => void;
  registerSeatNode: (id: string, node: HTMLElement | null) => void;
  sizes: SeatSizes;
}

// reverse flips the column so the vote card sits adjacent to the table on the
// bottom row.
function Seat({ seat, reverse, canTarget, onThrowAt, registerSeatNode, sizes }: SeatProps) {
  const canClick = canTarget && !seat.isMe;
  // Dimmed, not the highlighted ones themselves, is what carries the contrast:
  // fading every other seat makes the highlighted group unmissable regardless
  // of vote-card color, instead of relying on a subtle ring around cards that
  // are already accent-colored.
  const dimmed = seat.dimmed;
  return (
    <div
      className={`flex shrink-0 flex-col items-center gap-2 transition-opacity duration-150 ${reverse ? 'flex-col-reverse' : ''}`}
      style={{ width: sizes.seatW, opacity: dimmed ? 0.35 : 1 }}
    >
      <img
        ref={node => registerSeatNode(seat.id, node)}
        src={seat.avatarUrl}
        alt=""
        onClick={canClick ? (e) => onThrowAt(seat.id, e) : undefined}
        className={`block rounded-full border border-sp-border bg-sp-card-bg ${canClick ? 'cursor-crosshair' : 'cursor-default'}`}
        style={{ width: seat.size, height: seat.size }}
      />
      <div
        className="overflow-hidden text-center text-xs font-semibold text-ellipsis whitespace-nowrap text-sp-text-dim"
        style={{ maxWidth: sizes.seatW - 6 }}
      >{seat.displayName}</div>

      {seat.showBlank && (
        <div className="rounded-[5px] border-[1.5px] border-sp-border-strong bg-sp-card-bg" style={{ width: sizes.cardW, height: sizes.cardH }} />
      )}
      {(seat.showPlaced || seat.showValue) && (
        <div style={{ width: sizes.cardW, height: sizes.cardH, perspective: 300 }}>
          {seat.showValue ? (
            <div
              className="sp-flip-card h-full w-full"
              style={{ animationDelay: `${seat.flipDelay}ms` }}
            >
              <div
                className="sp-flip-face rounded-[5px] border-2 border-sp-accent bg-sp-accent-panel font-sp-mono font-bold text-sp-accent-text"
                style={{ width: sizes.cardW, height: sizes.cardH, fontSize: sizes.cardFont }}
              >?</div>
              <div
                className="sp-flip-face sp-flip-face-back rounded-[5px] border-2 border-sp-accent bg-sp-accent-panel font-sp-mono font-bold text-sp-accent-on-card"
                style={{ width: sizes.cardW, height: sizes.cardH, fontSize: sizes.cardFont }}
              >{seat.voteValue}</div>
            </div>
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-[5px] border-2 border-sp-accent bg-sp-accent-panel font-sp-mono font-bold text-sp-accent-text"
              style={{ fontSize: sizes.cardFont }}
            >?</div>
          )}
        </div>
      )}
    </div>
  );
}

interface SeatRowProps extends Omit<SeatProps, 'seat'> {
  seats: SeatData[];
}

function SeatRow({ seats, reverse, ...seatProps }: SeatRowProps) {
  if (seats.length === 0) return null;
  return (
    <div
      className={`flex flex-wrap justify-center ${reverse ? 'items-start' : 'items-end'}`}
      style={{ gap: `14px ${SEAT_GAP}px` }}
    >
      {seats.map(seat => <Seat key={seat.id} seat={seat} reverse={reverse} {...seatProps} />)}
    </div>
  );
}

// Fallback used only until the VotingBar has reported its real measured
// height (e.g. the very first paint) — a reasonable guess for the
// pre-reveal vote-card row's height, so there's no visible pop-in once
// the real measurement arrives a frame later.
const CLEARANCE_FALLBACK = 120;
const CLEARANCE_BUFFER = 20;

interface SeatTableProps {
  participants: Record<string, Participant>;
  uid: string | null;
  isRevealed: boolean;
  anyVote: boolean;
  allVoted: boolean;
  onReveal: () => void;
  canTarget: boolean;
  onThrowAt: (id: string, e: React.MouseEvent) => void;
  registerSeatNode: (id: string, node: HTMLElement | null) => void;
  getSeatNode: (id: string) => HTMLElement | null;
  stageRef: RefObject<HTMLDivElement | null>;
  throws: ThrowEvent[];
  onThrowDone: (id: string) => void;
  highlightValues?: (CardValue | null)[];
  bottomClearance?: number;
}

export default function SeatTable({
  participants, uid, isRevealed, anyVote, allVoted, onReveal,
  canTarget, onThrowAt, registerSeatNode, getSeatNode, stageRef, throws, onThrowDone,
  highlightValues = [], bottomClearance: measuredClearance,
}: SeatTableProps) {
  const active: ParticipantEntry[] = Object.entries(participants).filter(([, p]) => !p.isObserver).sort(byJoinOrder);
  const observers: ParticipantEntry[] = Object.entries(participants).filter(([, p]) => p.isObserver).sort(byJoinOrder);
  const n = active.length;
  const votedCount = active.filter(([, p]) => p.vote != null).length;
  // One breakpoint governs both wide-only behaviors: end seats on the table's
  // short sides, and the vertical observer rail (which drops below the table
  // on narrow viewports so seats keep the full width).
  const wide = useMediaQuery(END_SEAT_BREAKPOINT);
  const viewportWidth = useViewportWidth();
  const sizes = n >= COMPACT_AT ? COMPACT_SIZES : DEFAULT_SIZES;

  const seats = active.map(([id, p], seatIdx) => {
    const isMe = id === uid;
    const hasVoted = p.vote != null;
    return {
      id, isMe,
      avatarUrl: participantAvatarSrc(p),
      size: isMe ? sizes.meAvatar : sizes.avatar,
      displayName: isMe ? p.name + ' (you)' : p.name,
      showBlank: !isRevealed && !hasVoted,
      showPlaced: !isRevealed && hasVoted,
      showValue: isRevealed,
      voteValue: p.vote,
      // Staggered per seat so the reveal ripples across the table instead of
      // every card flipping in perfect unison.
      flipDelay: (seatIdx % 8) * 45,
      // Only dim once there's something to contrast against — an empty
      // highlight set (nobody has a value in it, e.g. mid-transition) should
      // never fade the whole table out.
      dimmed: isRevealed && highlightValues.length > 0 && !highlightValues.includes(p.vote),
    };
  });

  const { top, bottom, leftEnd, rightEnd } = distributeSeats(seats, wide);
  const widestRow = Math.max(top.length, bottom.length, 1);
  // Both breakpoint tables always end with a `minWidth: 0` entry, so `find`
  // is guaranteed to match.
  const widthFloor = WIDTH_FLOOR_BREAKPOINTS.find(b => viewportWidth >= b.minWidth)!.floor;
  const stageMaxWidth = Math.min(STAGE_MAX_CAP, Math.max(360, widthFloor, widestRow * (sizes.seatW + SEAT_GAP) + 48));
  const tableHeight = HEIGHT_BREAKPOINTS.find(b => viewportWidth >= b.minWidth)!.height;
  // Clearance for the fixed VotingBar is the bar's real measured height
  // (plus a small buffer) rather than a guess, so it only ever changes by
  // as much as the bar actually grows/shrinks — and that change transitions
  // smoothly (see padding-bottom transition below) instead of snapping,
  // so the table doesn't visibly jump when the distribution panel appears.
  const bottomClearance = (measuredClearance || CLEARANCE_FALLBACK) + CLEARANCE_BUFFER;
  const seatProps = { canTarget, onThrowAt, registerSeatNode, sizes };

  return (
    // The stage contains every throwable avatar (seats and observers), so
    // ThrowOverlay's rect math is valid for all targets.
    <div ref={stageRef} className="relative flex min-w-0 flex-1 flex-row">
      <div
        className="flex min-w-0 flex-1 flex-col items-center justify-center px-4 pt-5 transition-[padding-bottom] duration-250"
        style={{ paddingBottom: bottomClearance }}
      >
        <div className="flex w-full flex-col gap-4.5" style={{ maxWidth: stageMaxWidth }}>
          <SeatRow seats={top} {...seatProps} />

          <div className="flex items-center gap-4">
            {leftEnd && <Seat seat={leftEnd} {...seatProps} />}
            <div
              className={`flex flex-1 items-center justify-center rounded-[28px] bg-sp-table-center transition-[border-color,box-shadow] duration-150 ${
                !isRevealed && allVoted ? 'border-2 border-sp-accent shadow-[0_0_0_3px_var(--sp-accent-glow)]' : 'border border-sp-border'
              }`}
              style={{ minWidth: TABLE_MIN_WIDTH, height: tableHeight }}
            >
              {!isRevealed && (
                allVoted ? (
                  <div className="sp-kbd-hint-wrap">
                    {anyVote && (
                      <div className="sp-kbd-hint rounded-md border border-sp-border-strong bg-sp-panel-3 px-1.5 py-0.5 text-[11px] font-semibold text-sp-text-dim shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                        Enter
                      </div>
                    )}
                    <button
                      onClick={onReveal}
                      disabled={!anyVote}
                      className={`rounded-lg border-none bg-sp-accent px-5 py-2.5 font-sp-font text-sm font-bold text-sp-bg ${anyVote ? 'cursor-pointer opacity-100' : 'cursor-default opacity-45'}`}
                    >Reveal votes</button>
                  </div>
                ) : (
                  <div className="font-sp-mono text-[15px] font-bold text-sp-text-dim">
                    {votedCount}/{n}
                  </div>
                )
              )}
            </div>
            {rightEnd && <Seat seat={rightEnd} {...seatProps} />}
          </div>

          <SeatRow seats={bottom} reverse {...seatProps} />

          {!wide && <ObserverRail horizontal observers={observers} uid={uid} canTarget={canTarget} onThrowAt={onThrowAt} registerSeatNode={registerSeatNode} />}
        </div>
      </div>

      {wide && <ObserverRail observers={observers} uid={uid} canTarget={canTarget} onThrowAt={onThrowAt} registerSeatNode={registerSeatNode} />}

      <ThrowOverlay throws={throws} getSeatNode={getSeatNode} stageNode={stageRef.current} onThrowDone={onThrowDone} />
    </div>
  );
}
