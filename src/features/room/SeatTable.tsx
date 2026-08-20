import { useEffect, useRef, useState, type RefObject } from 'react';
import { participantAvatarSrc } from '../avatar/index.js';
import useMediaQuery from '../../shared/hooks/useMediaQuery.ts';
import ObserverRail from './ObserverRail.tsx';
import ThrowOverlay from './ThrowOverlay.tsx';
import GtaOverlay from './GtaOverlay.tsx';
import type { Participant, CardValue } from '../../types/room.ts';
import type { ThrowEvent } from '../../types/throws.ts';
import type { DriverState } from '../../types/gta.ts';

// CSSProperties doesn't allow arbitrary custom-property keys (--cx, --cr,
// etc.) by default -- these are read by @keyframes in theme.css via var(),
// not by React/CSS itself, so a plain string/number-keyed style object is
// the correct escape hatch here (matches GtaOverlay.tsx's own StyleVars).
type StyleVars = React.CSSProperties & Record<string, string | number>;

type ParticipantEntry = [string, Participant];

function byJoinOrder([, a]: ParticipantEntry, [, b]: ParticipantEntry) {
  return (a.joinedAt ?? 0) - (b.joinedAt ?? 0);
}

// Seats sit in wrapping flex rows above and below the table, plus one on each
// table end on wide viewports, so any player count lays out without overlap.
// Two sizing steps: default, and compact once the room gets big — wrapping
// absorbs crowding, so no continuous shrink is needed.
// GTA Mode hit animations. Only squash actually reads as "flattened" --
// wobble is the lighter graze/near-miss version of the same feedback.
// Durations match the sp-gta-wobble/sp-gta-squash keyframes in theme.css.
const WOBBLE_MS = 600;
const SQUASH_MS = 700;
// How many table hits it takes before the table visibly splits in half --
// enough to feel earned across a chaotic round rather than an instant gimmick.
const TABLE_SPLIT_THRESHOLD = 5;

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
  // True while this seat's occupant is off driving -- the avatar is fully
  // hidden here (it wobbles in place through boarding first, then vanishes
  // right as the car's own rider becomes visible).
  vacated: boolean;
  // GTA Mode hit feedback, most-severe first -- a squash always wins over a
  // graze since both can never be simultaneously true for the same seat.
  hitAnimation: 'squash' | 'wobble' | null;
  // Timestamp of the most recent squash (not a mere graze) -- only a real
  // squash scatters this seat's vote card; seeds the scatter direction so
  // repeated hits look different each time.
  squashAt: number | null;
  // True once this seat's occupant has been run over this round -- persists
  // (grayscale + WASTED stamp) until the round resets, unless they're
  // currently the one driving (you can't be wasted while behind the wheel).
  wasted: boolean;
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
  onThrowAt: (id: string, e?: React.MouseEvent) => void;
  registerSeatNode: (id: string, node: HTMLElement | null) => void;
  sizes: SeatSizes;
}

// reverse flips the column so the vote card sits adjacent to the table on the
// bottom row.
// Short tokens (numbers, "XS".."XXL", "?", "☕") fit the standard card as-is.
// Longer labels (ROM's "Needs breaking down"/"13+ sprints", any Custom free
// text) get a wider card instead of shrinking the font to fit -- only that
// seat's card widens, everyone else's stays the standard size.
const LONG_LABEL_THRESHOLD = 3;
const WIDE_CARD_MULTIPLIER = 3;
const CARD_SCATTER_MS = 420;

// A small pseudo-random-looking but deterministic scatter direction from a
// hit's own timestamp, so repeated hits on the same seat scatter differently
// each time without needing extra state to track "which hit is this."
function scatterFor(seed: number): { cx: number; cy: number; crot: number } {
  const a = (Math.sin(seed) * 10000) % 1;
  const angle = a * Math.PI * 2;
  return {
    cx: Math.round(Math.cos(angle) * 26),
    cy: Math.round(Math.sin(angle) * 18 - 8),
    crot: Math.round((a - 0.5) * 70),
  };
}

function cardScatterStyle(squashAt: number | null): React.CSSProperties | undefined {
  if (squashAt == null) return undefined;
  const s = scatterFor(squashAt);
  return {
    '--cx': `${s.cx}px`, '--cy': `${s.cy}px`, '--crot': `${s.crot}deg`,
    animation: `sp-gta-card-scatter ${CARD_SCATTER_MS}ms cubic-bezier(.25,.7,.3,1) both`,
  } as StyleVars;
}

function Seat({ seat, reverse, canTarget, onThrowAt, registerSeatNode, sizes }: SeatProps) {
  const canClick = canTarget && !seat.isMe;
  // Dimmed, not the highlighted ones themselves, is what carries the contrast:
  // fading every other seat makes the highlighted group unmissable regardless
  // of vote-card color, instead of relying on a subtle ring around cards that
  // are already accent-colored.
  const dimmed = seat.dimmed;
  const isLongLabel = !!seat.voteValue && seat.voteValue.length > LONG_LABEL_THRESHOLD;
  const cardW = isLongLabel ? sizes.cardW * WIDE_CARD_MULTIPLIER : sizes.cardW;
  return (
    <div
      className={`flex shrink-0 flex-col items-center gap-2 transition-opacity duration-150 ${reverse ? 'flex-col-reverse' : ''}`}
      style={{ width: sizes.seatW, opacity: dimmed ? 0.35 : 1 }}
    >
      {/* While a weapon is equipped the avatar becomes a throw target, so it
          needs to be a real button -- otherwise throwing is mouse-only and
          the avatar is invisible to a screen reader. Outside targeting mode
          it stays decorative (the name below already carries the identity). */}
      <div className="relative" style={{ width: seat.size, height: seat.size }}>
        <img
          ref={node => registerSeatNode(seat.id, node)}
          src={seat.avatarUrl}
          alt=""
          role={canClick ? 'button' : undefined}
          tabIndex={canClick ? 0 : undefined}
          aria-label={canClick ? `Throw at ${seat.displayName}` : undefined}
          onClick={canClick ? (e) => onThrowAt(seat.id, e) : undefined}
          onKeyDown={canClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onThrowAt(seat.id);
            }
          } : undefined}
          className={`block rounded-full border border-sp-border bg-sp-card-bg ${canClick ? 'cursor-crosshair' : 'cursor-default'} ${seat.wasted ? 'grayscale' : ''}`}
          style={{
            width: seat.size,
            height: seat.size,
            // Fully hidden while vacated -- the car has its own rider by then
            // (see CarWithRider in GtaOverlay), so this would otherwise
            // double them up.
            opacity: seat.vacated ? 0 : 1,
            transition: 'opacity 150ms ease',
            animation:
              seat.hitAnimation === 'squash' ? `sp-gta-squash ${SQUASH_MS}ms cubic-bezier(.2,.8,.3,1)`
              : seat.hitAnimation === 'wobble' ? `sp-gta-wobble ${WOBBLE_MS}ms ease-out`
              : seat.wasted ? 'sp-gta-wasted-fall 500ms cubic-bezier(.3,.7,.4,1) both'
              : undefined,
          }}
        />
        {seat.wasted && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute font-sp-font text-[10px] font-black tracking-[0.04em] whitespace-nowrap text-[#c81e1e] uppercase [-webkit-text-stroke:1px_#1a0000] [text-shadow:0_1px_0_#1a0000]"
            style={{
              left: '50%', top: '50%',
              animation: 'sp-gta-wasted-stamp 420ms cubic-bezier(.2,.8,.3,1) 460ms both',
            }}
          >WASTED</span>
        )}
      </div>
      <div
        className="overflow-hidden text-center text-xs font-semibold text-ellipsis whitespace-nowrap text-sp-text-dim"
        style={{ maxWidth: sizes.seatW - 6 }}
      >{seat.displayName}</div>

      {/* GTA Mode: the car driving over this seat's card kicks it sideways
          and it settles back -- scatterFor derives the direction from the
          hit's own timestamp so repeated hits don't always kick the same way. */}
      <div style={cardScatterStyle(seat.squashAt)}>
        {seat.showBlank && (
          <div className="rounded-[5px] border-[1.5px] border-sp-border-strong bg-sp-card-bg" style={{ width: sizes.cardW, height: sizes.cardH }} />
        )}
        {(seat.showPlaced || seat.showValue) && (
          <div style={{ width: cardW, height: sizes.cardH, perspective: 300 }}>
            {seat.showValue ? (
              <div
                className="sp-flip-card h-full w-full"
                style={{ animationDelay: `${seat.flipDelay}ms` }}
              >
                <div
                  className="sp-flip-face rounded-[5px] border-2 border-sp-accent bg-sp-accent-panel font-sp-mono font-bold text-sp-accent-text"
                  style={{ width: cardW, height: sizes.cardH, fontSize: sizes.cardFont }}
                >?</div>
                <div
                  className="sp-flip-face sp-flip-face-back overflow-hidden rounded-[5px] border-2 border-sp-accent bg-sp-accent-panel px-1.5 text-center leading-[1.15] font-sp-mono font-bold text-sp-accent-on-card"
                  style={{
                    width: cardW,
                    height: sizes.cardH,
                    fontSize: isLongLabel ? Math.round(sizes.cardFont * 0.55) : sizes.cardFont,
                    whiteSpace: isLongLabel ? 'normal' : 'nowrap',
                    wordBreak: 'break-word',
                  }}
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

// A single crack decal, positioned by fraction (0..1) against whatever
// container it's rendered in -- the table itself when unsplit, or one half
// of it (in that half's own local fraction space) once split.
function TableCrack({ fx, fy, rot }: { fx: number; fy: number; rot: number }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute"
      width="34"
      height="34"
      viewBox="0 0 34 34"
      style={{
        left: `${fx * 100}%`,
        top: `${fy * 100}%`,
        marginLeft: -17,
        marginTop: -17,
        '--cr': `${rot}deg`,
        animation: 'sp-gta-crack-appear 260ms cubic-bezier(.3,1.4,.4,1) both',
      } as StyleVars}
    >
      <path
        d="M17 2 L15 12 L22 14 L13 17 L19 22 L11 21 L14 32 L9 20 L2 24 L8 16 L2 12 L10 13 Z"
        fill="none"
        stroke="var(--sp-border-strong)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity="0.75"
      />
    </svg>
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
  onThrowAt: (id: string, e?: React.MouseEvent) => void;
  registerSeatNode: (id: string, node: HTMLElement | null) => void;
  getSeatNode: (id: string) => HTMLElement | null;
  stageRef: RefObject<HTMLDivElement | null>;
  throws: ThrowEvent[];
  onThrowDone: (id: string) => void;
  highlightValues?: (CardValue | null)[];
  bottomClearance?: number;
  isDriving: boolean;
  forceEndDrive: boolean;
  drivers: Record<string, DriverState>;
  onPublishDrive: (state: Omit<DriverState, 'uid'>) => void;
  onExitDrive: () => void;
}

export default function SeatTable({
  participants, uid, isRevealed, anyVote, allVoted, onReveal,
  canTarget, onThrowAt, registerSeatNode, getSeatNode, stageRef, throws, onThrowDone,
  highlightValues = [], bottomClearance: measuredClearance,
  isDriving, forceEndDrive, drivers, onPublishDrive, onExitDrive,
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

  // seatId -> timestamp of its most recent GTA Mode hit, from any driver
  // (ours or a remote one) -- read by every viewer, not just the one
  // currently driving, so a bystander sees the same squash the driver caused.
  // SeatTable has no rAF loop of its own (unlike GtaOverlay), so each entry
  // is cleared by its own timer rather than relying on some other re-render
  // to notice the animation has finished -- otherwise the seat would carry a
  // stale 'squash'/'wobble' animation value indefinitely between hits.
  const [wobbling, setWobbling] = useState<Record<string, number>>({});
  const [squashed, setSquashed] = useState<Record<string, number>>({});
  // uids run over this round -- persists (grayscale + WASTED stamp) rather
  // than fading like a bump/squash does, and only clears when a new round
  // starts (mirrors votes resetting on the same transition).
  const [wasted, setWasted] = useState<Set<string>>(new Set());
  // Crack decals, as fractions (0..1) local to whichever surface they landed
  // on -- the whole table before the split, or a specific piece afterward
  // (see `side` -- 'left'/'right' cracks are local to that piece's own box,
  // 'table' cracks are local to the unsplit table and get partitioned into
  // the two pieces' local spaces once split happens under them).
  const [cracks, setCracks] = useState<{ fx: number; fy: number; rot: number; side: 'table' | 'left' | 'right' }[]>([]);
  // Once enough cracks land, the table splits into two separate pieces --
  // each becomes its own real physics obstacle (see obstacleIds below) that
  // can go on being hit and shoved independently, not just a one-time visual.
  const tableSplit = cracks.length >= TABLE_SPLIT_THRESHOLD;
  // Each piece's cumulative shove from being hit after the split: a small
  // discrete offset + rotation added per hit (not continuous physics), so a
  // piece that keeps getting rammed visibly skids further and further away
  // and keeps blocking the car from its new spot.
  const [pieceMove, setPieceMove] = useState<{ left: { x: number; y: number; rot: number }; right: { x: number; y: number; rot: number } }>(
    { left: { x: 0, y: 0, rot: 0 }, right: { x: 0, y: 0, rot: 0 } },
  );
  // Our own vacated state, reported directly by GtaOverlay off local phase
  // (not the RTDB round-trip that `id in drivers` relies on for remote
  // players) -- otherwise the seat's own avatar stays visible, duplicated
  // alongside the car, for however long that write takes to land.
  const [myVacated, setMyVacated] = useState(false);
  const wasRevealedRef = useRef(isRevealed);
  useEffect(() => {
    if (wasRevealedRef.current && !isRevealed) {
      setWasted(new Set());
      setCracks([]);
      setPieceMove({ left: { x: 0, y: 0, rot: 0 }, right: { x: 0, y: 0, rot: 0 } });
    }
    wasRevealedRef.current = isRevealed;
  }, [isRevealed]);
  const now = performance.now();

  // How far one hit shoves an already-split piece, and the cap on how far it
  // can be pushed in total -- capped so a piece can be rammed repeatedly
  // without ever leaving the board or ending up somewhere collision math
  // (still just its DOM rect) can't reasonably represent.
  const PIECE_SHOVE_PX = 7;
  const PIECE_SHOVE_MAX_PX = 46;
  const PIECE_SHOVE_ROT_DEG = 3;
  const PIECE_SHOVE_MAX_ROT_DEG = 22;

  const handleTableHit = (tableId: string, stageX: number, stageY: number, impactDx: number, impactDy: number) => {
    const stageNode = stageRef.current;
    if (!stageNode) return;
    const sb = stageNode.getBoundingClientRect();

    if (tableId === '__table__') {
      const tableNode = getSeatNode('__table__');
      if (!tableNode) return;
      const tb = tableNode.getBoundingClientRect();
      if (tb.width <= 0 || tb.height <= 0) return;
      // Impact point in stage-local px -> table-local px. This is already
      // the true contact point on the table's boundary (stepCar's overlap()
      // clamps the car's center to the table box, so one axis lands exactly
      // on an edge) -- nudge it in by a small fixed pixel margin, just
      // enough that the crack's own radius doesn't clip past the table's
      // rounded corner, rather than pulling every hit toward the center
      // with a percentage clamp.
      const margin = 15; // px, roughly the crack decal's own radius
      const px = Math.min(tb.width - margin, Math.max(margin, stageX + sb.left - tb.left));
      const py = Math.min(tb.height - margin, Math.max(margin, stageY + sb.top - tb.top));
      setCracks(c => [...c, { fx: px / tb.width, fy: py / tb.height, rot: Math.round(Math.random() * 360), side: 'table' }]);
      return;
    }

    // A piece hit after the split: place the crack in that piece's own live
    // rect, and shove the piece further away along the impact direction.
    const side: 'left' | 'right' = tableId === '__table__left' ? 'left' : 'right';
    const pieceNode = getSeatNode(tableId);
    if (pieceNode) {
      const pb = pieceNode.getBoundingClientRect();
      if (pb.width > 0 && pb.height > 0) {
        const margin = 15;
        const px = Math.min(pb.width - margin, Math.max(margin, stageX + sb.left - pb.left));
        const py = Math.min(pb.height - margin, Math.max(margin, stageY + sb.top - pb.top));
        setCracks(c => [...c, { fx: px / pb.width, fy: py / pb.height, rot: Math.round(Math.random() * 360), side }]);
      }
    }
    setPieceMove(pm => {
      const cur = pm[side];
      const nextX = Math.max(-PIECE_SHOVE_MAX_PX, Math.min(PIECE_SHOVE_MAX_PX, cur.x + impactDx * PIECE_SHOVE_PX));
      const nextY = Math.max(-PIECE_SHOVE_MAX_PX, Math.min(PIECE_SHOVE_MAX_PX, cur.y + impactDy * PIECE_SHOVE_PX));
      // Rotation direction alternates with which way the piece is being hit
      // (impactDx sign), so repeated hits from the same side keep twisting
      // the same way rather than fighting themselves back to level.
      const rotDelta = (impactDx >= 0 ? 1 : -1) * PIECE_SHOVE_ROT_DEG * (side === 'left' ? -1 : 1);
      const nextRot = Math.max(-PIECE_SHOVE_MAX_ROT_DEG, Math.min(PIECE_SHOVE_MAX_ROT_DEG, cur.rot + rotDelta));
      return { ...pm, [side]: { x: nextX, y: nextY, rot: nextRot } };
    });
  };

  const handleSeatBump = (seatId: string) => {
    const stamp = performance.now();
    setWobbling(w => ({ ...w, [seatId]: stamp }));
    // Only clears the entry this call itself set -- a later bump on the same
    // seat re-stamps it, and that bump's own timer is what clears it.
    setTimeout(() => setWobbling(w => {
      if (w[seatId] !== stamp) return w;
      const rest = { ...w };
      delete rest[seatId];
      return rest;
    }), WOBBLE_MS);
  };
  const handleSeatSquash = (seatId: string) => {
    const stamp = performance.now();
    setSquashed(s => ({ ...s, [seatId]: stamp }));
    setTimeout(() => setSquashed(s => {
      if (s[seatId] !== stamp) return s;
      const rest = { ...s };
      delete rest[seatId];
      return rest;
    }), SQUASH_MS);
    // A driver can't be wasted by getting squashed -- they're in a car, not
    // sitting in the seat that just got hit. Same signal as `vacated` above
    // (myVacated for us, `in drivers` for everyone else): still occupied
    // (and hittable) through arriving and boarding, only actually vacated
    // once driving starts.
    const targetVacated = seatId === uid ? myVacated : seatId in drivers;
    if (!targetVacated) setWasted(w => (w.has(seatId) ? w : new Set(w).add(seatId)));
  };

  // Remote drivers report their hit target on the streamed position payload
  // (see roomStore.gta.ts), re-publishing the same value for as long as it
  // stays true -- track what we've already animated per uid so a held hit
  // triggers the animation once, not every throttled tick.
  const lastRemoteHitRef = useRef<Record<string, string | null | undefined>>({});
  useEffect(() => {
    for (const d of Object.values(drivers)) {
      if (d.hit && d.hit !== lastRemoteHitRef.current[d.uid]) handleSeatSquash(d.hit);
      lastRemoteHitRef.current[d.uid] = d.hit ?? null;
    }
    // handleSeatSquash is intentionally omitted -- it's redefined every
    // render but stable in behavior, and depending on it would rerun this
    // effect (and risk re-processing the same drivers) on every unrelated
    // re-render instead of only when drivers actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers]);

  const hitAnimationFor = (id: string): 'squash' | 'wobble' | null => {
    const squashAt = squashed[id];
    if (squashAt && now - squashAt < SQUASH_MS) return 'squash';
    const wobbleAt = wobbling[id];
    if (wobbleAt && now - wobbleAt < WOBBLE_MS) return 'wobble';
    return null;
  };
  const squashAtFor = (id: string): number | null => {
    const squashAt = squashed[id];
    return squashAt && now - squashAt < CARD_SCATTER_MS ? squashAt : null;
  };

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
      // Our own seat uses GtaOverlay's direct local signal (instant, no
      // network round-trip); everyone else's uses their live entry in
      // drivers, which is the only signal we have for a remote player.
      vacated: isMe ? myVacated : id in drivers,
      hitAnimation: hitAnimationFor(id),
      squashAt: squashAtFor(id),
      wasted: wasted.has(id),
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

  // Stable per-driver color assignment (join order), and every avatar on the
  // board GTA Mode can collide with -- active seats, observers, and the
  // table itself. Once split, the table stops being one obstacle and
  // becomes its two pieces instead, each independently hittable.
  const joinOrderIds = [...active, ...observers].map(([id]) => id);
  const obstacleIds = [...(tableSplit ? ['__table__left', '__table__right'] : ['__table__']), ...joinOrderIds];

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
              ref={node => registerSeatNode('__table__', node)}
              className={`relative flex flex-1 items-center justify-center rounded-[28px] transition-[border-color,box-shadow] duration-150 ${
                tableSplit ? '' : `overflow-hidden bg-sp-table-center ${!isRevealed && allVoted ? 'border-2 border-sp-accent shadow-[0_0_0_3px_var(--sp-accent-glow)]' : 'border border-sp-border'}`
              }`}
              style={{ minWidth: TABLE_MIN_WIDTH, height: tableHeight }}
            >
              {/* GTA Mode: once enough cracks land, the table splits into two
                  separate pieces -- each keeps its own rounded outer corners
                  and border, with the inner (broken) edge carved into a
                  jagged zigzag via clip-path so the seam reads as a fracture.
                  Each piece is now also its own obstacle in obstacleIds
                  above: getting hit again shoves it further via pieceMove
                  (a small discrete offset + rotation per hit, capped), so it
                  keeps skidding away and keeps blocking the car from
                  wherever it ends up -- a real, independently-hittable
                  entity, not just a one-time settle animation. */}
              {tableSplit ? (
                <>
                  {/* Each piece owns its cracks as children in its own local
                      coordinate space (0..1 across just that piece), so a
                      crack lands on solid material and travels with the
                      piece as pieceMove shoves it around. */}
                  <div
                    ref={node => registerSeatNode('__table__left', node)}
                    aria-hidden="true"
                    className="absolute top-0 bottom-0 left-0 overflow-hidden border border-sp-border bg-sp-table-center shadow-[4px_0_10px_rgba(0,0,0,0.18)]"
                    style={{
                      width: 'calc(50% + 14px)',
                      borderTopLeftRadius: 28,
                      borderBottomLeftRadius: 28,
                      clipPath:
                        'polygon(0 0, 100% 0, 78% 12%, 92% 24%, 74% 36%, 90% 50%, 72% 62%, 88% 76%, 76% 88%, 100% 100%, 0 100%)',
                      transform: `translate(${-13 + pieceMove.left.x}px, ${1 + pieceMove.left.y}px) rotate(${-2.6 + pieceMove.left.rot}deg)`,
                      transition: 'transform 220ms cubic-bezier(.2,.7,.3,1)',
                      animation: 'sp-gta-table-split-left 420ms cubic-bezier(.3,.6,.35,1)',
                    }}
                  >
                    {cracks.filter(c => c.side === 'left').map((c, i) => (
                      <TableCrack key={i} fx={c.fx} fy={c.fy} rot={c.rot} />
                    ))}
                  </div>
                  <div
                    ref={node => registerSeatNode('__table__right', node)}
                    aria-hidden="true"
                    className="absolute top-0 right-0 bottom-0 overflow-hidden border border-sp-border bg-sp-table-center shadow-[-4px_0_10px_rgba(0,0,0,0.18)]"
                    style={{
                      width: 'calc(50% + 14px)',
                      borderTopRightRadius: 28,
                      borderBottomRightRadius: 28,
                      clipPath:
                        'polygon(22% 12%, 0 0, 100% 0, 100% 100%, 0 100%, 24% 88%, 12% 76%, 28% 62%, 10% 50%, 26% 36%, 8% 24%)',
                      transform: `translate(${13 + pieceMove.right.x}px, ${1 + pieceMove.right.y}px) rotate(${2.6 + pieceMove.right.rot}deg)`,
                      transition: 'transform 220ms cubic-bezier(.2,.7,.3,1)',
                      animation: 'sp-gta-table-split-right 420ms cubic-bezier(.3,.6,.35,1)',
                    }}
                  >
                    {cracks.filter(c => c.side === 'right').map((c, i) => (
                      <TableCrack key={i} fx={c.fx} fy={c.fy} rot={c.rot} />
                    ))}
                  </div>
                </>
              ) : (
                // GTA Mode: cracks left by the car ramming the table, pinned
                // as fractions of the table's own box so they stay put as it
                // resizes. Purely decorative, so it's excluded from the a11y tree.
                cracks.filter(c => c.side === 'table').map((c, i) => <TableCrack key={i} fx={c.fx} fy={c.fy} rot={c.rot} />)
              )}

              {/* The visual vote counter and the reveal are otherwise silent to
                  a screen reader -- this narrates round progress instead. */}
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {isRevealed
                  ? 'Votes revealed'
                  : `${votedCount} of ${n} ${n === 1 ? 'person has' : 'people have'} voted`}
              </div>

              {!isRevealed && (
                allVoted ? (
                  <div className="sp-kbd-hint-wrap">
                    {anyVote && (
                      <div aria-hidden="true" className="sp-kbd-hint rounded-md border border-sp-border-strong bg-sp-panel-3 px-1.5 py-0.5 text-[11px] font-semibold text-sp-text-dim shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
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
                  <div aria-hidden="true" className="font-sp-mono text-[15px] font-bold text-sp-text-dim">
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

      {uid && (isDriving || Object.keys(drivers).length > 0) && (
        <GtaOverlay
          active={isDriving}
          forceEnd={forceEndDrive}
          driverUid={uid}
          driverAvatarUrl={participantAvatarSrc(participants[uid] ?? {})}
          colorIndex={joinOrderIds.indexOf(uid)}
          remoteDrivers={Object.values(drivers).filter(d => d.uid !== uid)}
          getAvatarForUid={otherUid => participantAvatarSrc(participants[otherUid] ?? {})}
          colorIndexForUid={otherUid => joinOrderIds.indexOf(otherUid)}
          obstacleIds={obstacleIds}
          wastedIds={wasted}
          getSeatNode={getSeatNode}
          stageNode={stageRef.current}
          onPublish={onPublishDrive}
          onSeatBump={handleSeatBump}
          onSeatSquash={handleSeatSquash}
          onTableHit={handleTableHit}
          onSeatVacatedChange={setMyVacated}
          onExit={onExitDrive}
        />
      )}
    </div>
  );
}
