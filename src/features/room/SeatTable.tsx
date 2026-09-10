import NudgeButton from './NudgeButton.tsx';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { participantAvatarSrc } from '../avatar/index.js';
import useMediaQuery from '../../shared/hooks/useMediaQuery.ts';
import ObserverRail from './ObserverRail.tsx';
import ThrowOverlay from './ThrowOverlay.tsx';
import GtaOverlay from './GtaOverlay.tsx';
import { seatVacated, debrisPieces, smokePuffs, type GtaPhase } from './gtaLifecycle.ts';
import { fracturePolygon } from './tableFracture.ts';
import type { Participant, CardValue } from '../../types/room.ts';
import type { ThrowEvent } from '../../types/throws.ts';
import type { DriverState, TableCrackEvent, TablePieceMove, WastedMap } from '../../types/gta.ts';

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
// Ignore repeat table hits landing inside this window. stepCar reports a hit
// on every frame the car is still overlapping at speed, so without this one
// ram publishes a whole burst of cracks (an RTDB write each) and can blow
// through the split threshold in a single collision -- which made the table
// break on first contact rather than after sustained damage.
const TABLE_HIT_COOLDOWN_MS = 140;
// Total cracks kept per round. Past this the table is already thoroughly
// wrecked and further decals only cost DOM and writes.
const TABLE_CRACK_CAP = 14;
// How far in from a surface's edge an impact point is nudged before a crack is
// placed there. Small on purpose: the crack's job is to mark where the car hit,
// so accuracy to the contact point matters more than keeping the whole decal
// inside the rounded corners.
const CRACK_EDGE_MARGIN = 10;
// How long the one-shot debris/dust burst at the moment of the split stays
// mounted -- covers the slowest smoke puff (worst case ~1360ms: 1140ms of
// animation behind a 220ms stagger, see smokePuffs in gtaLifecycle) so it
// finishes fading rather than being cut mid-fade.
const SPLIT_BURST_MS = 1450;

const SEAT_GAP = 8;
const DEFAULT_SIZES = { seatW: 96, avatar: 52, meAvatar: 60, cardW: 34, cardH: 48, cardFont: 16 };
const COMPACT_SIZES = { seatW: 78, avatar: 40, meAvatar: 46, cardW: 26, cardH: 36, cardFont: 12 };
// Phone tier. Sized so a row actually fits: at 390px (358px after the stage's
// px-4) a 62px seat plus the 8px gap gives 5 per row, so the common 8-10
// person room lands in two clean rows instead of fragmenting into four or
// five. The seat count alone used to decide this, which meant a 4-person room
// on a phone still rendered 96px seats and wrapped every row.
const PHONE_SIZES = { seatW: 62, avatar: 34, meAvatar: 40, cardW: 22, cardH: 32, cardFont: 11 };
const COMPACT_AT = 17;
// Below this the phone tier applies regardless of headcount -- 96px seats
// simply do not fit a phone, however few people are in the room.
const PHONE_MAX_WIDTH = 560;
// ...and between the two, a mid tier for the awkward band between a phone
// and a tablet. Deliberately well below tablet width: a 768px screen has
// room for the full-size seats (12 of them need 568px of 736), and forcing
// compact there just left the seating cluster small and adrift in empty
// space.
const COMPACT_MAX_WIDTH = 640;
const STAGE_MAX_CAP = 1180;
// Matches the stage column's own px-4, so width math can subtract what the
// padding actually costs rather than assuming the full viewport is usable.
const STAGE_H_PADDING = 32;
const TABLE_MIN_WIDTH = 200;
// The table shrinks with the tier too: 200x170 is a large share of a phone
// viewport, and the seats around it matter more than the furniture.
const PHONE_TABLE_MIN_WIDTH = 130;
const PHONE_TABLE_HEIGHT = 104;
const END_SEAT_BREAKPOINT = '(min-width: 640px)';

// A small room (few seats) would otherwise size the table to just fit those
// seats regardless of screen size, leaving it stranded tiny in the middle of
// a big monitor. These floors scale the table up with the viewport so it
// still reads as a table on wide screens, independent of headcount — width
// and height climb together so it stays table-shaped instead of a thin bar.
// The sub-900 entries keep phones and tablets from all collapsing into one
// flat bucket, which is what made a 390px phone and an 890px laptop render
// identically.
const WIDTH_FLOOR_BREAKPOINTS = [
  { minWidth: 1600, floor: 620 },
  { minWidth: 1200, floor: 520 },
  { minWidth: 900, floor: 420 },
  // A tablet was landing on the 300 floor and, with a small room, ending up
  // with the table at its 200px bare minimum inside a 736px stage -- mostly
  // empty space either side. 380 fills the width sensibly without letting
  // the table balloon: it stays a step below the 900px band's 420.
  { minWidth: 640, floor: 380 },
  { minWidth: 0, floor: 0 },
];
const HEIGHT_BREAKPOINTS = [
  { minWidth: 1600, height: 260 },
  { minWidth: 1200, height: 220 },
  { minWidth: 900, height: 190 },
  // Tablet-ish. Was 150, which left the table looking undersized against a
  // 1024px-tall portrait screen; 180 keeps it in proportion with the
  // full-size seats this band now uses without growing it much.
  { minWidth: 640, height: 180 },
  { minWidth: PHONE_MAX_WIDTH, height: 130 },
  { minWidth: 0, height: PHONE_TABLE_HEIGHT },
];

// The vertical budget. Everything above picks a size from viewport *width*,
// which is only half the question: the stage has to fit a seat row, the table,
// another seat row and the results panel between the header and the bottom of
// the screen. On a short screen that budget is blown even though the screen is
// wide, so these scale the width-derived table height down and force the
// compact seat tier.
//
// Thresholds are the common laptop heights: a 900px-tall screen is roomy, 800
// is the 16:10 13" default, 720 is a 1366x768 or scaled 1080p laptop with
// browser chrome, and below 660 is a short window someone has resized.
const SHORT_VIEWPORT_TIERS = [
  { minHeight: 960, tableScale: 1, compactSeats: false },
  // A 900px-tall screen is roomy horizontally but not vertically: at 1600px
  // wide the table's natural 260px plus two seat rows and the results panel
  // still overshoots, so this band trims the table rather than the seats.
  { minHeight: 860, tableScale: 0.85, compactSeats: false },
  { minHeight: 780, tableScale: 0.8, compactSeats: false },
  { minHeight: 700, tableScale: 0.72, compactSeats: true },
  { minHeight: 0, tableScale: 0.52, compactSeats: true },
];
// Below this a table is doing more harm than good -- it would be a sliver, and
// the seats around it are what people actually read.
const MIN_TABLE_HEIGHT = 96;
// Under this height the row gaps and the stage's top padding tighten too. The
// table alone can't free enough space once the screen is this short.
const TIGHT_VIEWPORT_HEIGHT = 700;

// Height matters as much as width here. Sizing on width alone meant a 1280px
// screen got the same 220px table whether it was 1400px tall or 720px, so on a
// short laptop the bottom seat row ended up behind the results panel -- three
// of eight people, including yourself, simply gone at the moment of the reveal.
function useViewportSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
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
  // The room's creator. Shown to everyone so it's obvious who to ask for a
  // deck change -- the deck control only renders for them, so without this
  // nobody else has any way to know who that is.
  isHost: boolean;
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
  onNudge?: (uid: string) => void;
  nudgeDisabled?: boolean;
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

function Seat({ seat, reverse, canTarget, onThrowAt, registerSeatNode, sizes, onNudge, nudgeDisabled }: SeatProps) {
  const canClick = canTarget && !seat.isMe;
  // Dimmed, not the highlighted ones themselves, is what carries the contrast:
  // fading every other seat makes the highlighted group unmissable regardless
  // of vote-card color, instead of relying on a subtle ring around cards that
  // are already accent-colored.
  const dimmed = seat.dimmed;
  const isLongLabel = !!seat.voteValue && seat.voteValue.length > LONG_LABEL_THRESHOLD;
  // Never wider than the seat it belongs to: a 3x-widened card used to spill
  // over the neighbouring seats, which is most obvious in the smaller tiers
  // where the multiplied width exceeds the whole seat slot.
  const cardW = isLongLabel ? Math.min(sizes.cardW * WIDE_CARD_MULTIPLIER, sizes.seatW) : sizes.cardW;
  return (
    <div
      className={`flex shrink-0 flex-col items-center gap-2 transition-opacity duration-150 ${reverse ? 'flex-col-reverse' : ''}`}
      style={{ width: sizes.seatW, opacity: dimmed ? 0.35 : 1 }}
    >
      {/* While a weapon is equipped the avatar becomes a throw target, so it
          needs to be a real button -- otherwise throwing is mouse-only and
          the avatar is invisible to a screen reader. Outside targeting mode
          it stays decorative (the name below already carries the identity). */}
      {/* sp-seat-grounded paints a contact shadow under the avatar so it sits
          on the table rather than floating over it. Dropped while vacated --
          the seat is empty, so there's nothing to cast one. */}
      <div
        className={`relative${seat.vacated ? '' : ' sp-seat-grounded'}`}
        style={{ width: seat.size, height: seat.size }}
      >
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
          className={`block rounded-full border border-sp-border bg-sp-card-bg ${canClick ? 'cursor-crosshair' : 'cursor-default'} ${seat.wasted && !seat.vacated ? 'grayscale' : ''}`}
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
              // The fall animation holds its end state (`both`), so it stays
              // gated on being in the seat too -- otherwise someone who
              // drove off while wasted would reappear already collapsed.
              : seat.wasted && !seat.vacated ? 'sp-gta-wasted-fall 500ms cubic-bezier(.3,.7,.4,1) both'
              : undefined,
          }}
        />
        {/* Tied to the avatar being present, not just to being wasted: the
            img above hides itself while vacated, and without the same check
            the stamp would be left floating over an empty seat while its
            owner is off driving. */}
        {seat.wasted && !seat.vacated && (
          <span
            aria-hidden="true"
            // Scaled down with the seat: at the phone tier's 34px avatar the
            // full-size stamp is wider than the seat itself and would sit on
            // top of whoever is next to them.
            className={`pointer-events-none absolute font-sp-font font-black tracking-[0.04em] whitespace-nowrap text-[#c81e1e] uppercase [-webkit-text-stroke:1px_#1a0000] [text-shadow:0_1px_0_#1a0000] ${seat.size < 44 ? 'text-[7px]' : 'text-[10px]'}`}
            style={{
              left: '50%', top: '50%',
              animation: 'sp-gta-wasted-stamp 420ms cubic-bezier(.2,.8,.3,1) 460ms both',
            }}
          >WASTED</span>
        )}
      </div>
      {/* Name and badge share one wrapper so the bottom row's
          flex-col-reverse (which puts vote cards nearest the table) can't
          flip them relative to each other -- the badge belongs under the
          name, not above it. Its own line rather than beside the name, which
          is already truncated to the seat width. */}
      <div className="flex flex-col items-center">
        {/* Allowed to spill a little past the seat's own width: names sit
            above the avatars with horizontal space either side, and clipping
            "Player 1 (you)" to "Player 1 (y…" costs more than the slight
            overlap does. Still bounded, so a long name can't shove the row. */}
        <div
          className="overflow-hidden text-center text-xs font-semibold text-ellipsis whitespace-nowrap text-sp-text-dim"
          style={{ maxWidth: sizes.seatW + 22 }}
        >{seat.displayName}</div>
        {seat.isHost && (
          <div className="font-sp-font text-[9px] font-bold tracking-[0.06em] text-sp-text-faintest uppercase">
            Host
          </div>
        )}
      </div>

      {/* GTA Mode: the car driving over this seat's card kicks it sideways
          and it settles back -- scatterFor derives the direction from the
          hit's own timestamp so repeated hits don't always kick the same way. */}
      <div style={cardScatterStyle(seat.squashAt)}>
        {seat.showBlank && (
          <div style={{ width: Math.max(36, sizes.cardW), height: sizes.cardH }}>
            {!seat.isMe && onNudge ? (
              <NudgeButton name={seat.displayName} onClick={() => onNudge(seat.id)} disabled={nudgeDisabled} />
            ) : (
              <div className="h-full w-full rounded-[5px] border border-dashed border-sp-border-strong bg-sp-card-bg" />
            )}
          </div>
        )}
        {(seat.showPlaced || seat.showValue) && (
          <div style={{ width: cardW, height: sizes.cardH, perspective: 300 }}>
            {seat.showValue ? (
              <div
                className="sp-flip-card h-full w-full"
                style={{ animationDelay: `${seat.flipDelay}ms` }}
              >
                <div
                  className="sp-flip-face rounded-[5px] border border-sp-border-strong bg-sp-card-bg font-sp-mono font-bold text-sp-text-dim"
                  style={{ width: cardW, height: sizes.cardH, fontSize: sizes.cardFont }}
                >✓</div>
                <div
                  className="sp-flip-face sp-flip-face-back overflow-hidden rounded-[5px] border border-sp-border-strong bg-sp-card-bg px-1.5 text-center leading-[1.15] font-sp-mono font-bold text-sp-text"
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
                className="flex h-full w-full items-center justify-center rounded-[5px] border border-sp-border-strong bg-sp-card-bg font-sp-mono font-bold text-sp-text-dim"
                style={{ fontSize: sizes.cardFont }}
              >✓</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Phone layout: participants as a two-column list instead of ringed around a
// table. The around-the-table arrangement is the whole point of the desktop
// view, but at 390px the table is a ~104px empty slab and the seats wrap into
// fragmented rows either side of it -- the metaphor stops paying for the space
// it costs. A row per person reads immediately, fits far more people before
// scrolling, and gives each vote somewhere unambiguous to sit.
function ParticipantGrid({ seats, canTarget, onThrowAt, registerSeatNode, onNudge, nudgeDisabled }: {
  onNudge?: (uid: string) => void;
  nudgeDisabled?: boolean;
  seats: SeatData[];
  canTarget: boolean;
  onThrowAt: (id: string, e?: React.MouseEvent) => void;
  registerSeatNode: (id: string, node: HTMLElement | null) => void;
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-1.5">
      {seats.map(seat => {
        const canClick = canTarget && !seat.isMe;
        return (
          <div
            key={seat.id}
            className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-opacity duration-150 ${
              seat.isMe ? 'border-sp-accent-border bg-sp-accent-panel' : 'border-sp-border bg-sp-card-bg'
            }`}
            style={{ opacity: seat.dimmed ? 0.35 : 1 }}
          >
            <img
              ref={node => registerSeatNode(seat.id, node)}
              src={seat.avatarUrl}
              alt=""
              role={canClick ? 'button' : undefined}
              tabIndex={canClick ? 0 : undefined}
              aria-label={canClick ? `Throw at ${seat.displayName}` : undefined}
              onClick={canClick ? e => onThrowAt(seat.id, e) : undefined}
              onKeyDown={canClick ? e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onThrowAt(seat.id); }
              } : undefined}
              className={`block shrink-0 rounded-full border border-sp-border bg-sp-card-bg ${canClick ? 'cursor-crosshair' : ''} ${seat.wasted ? 'grayscale' : ''}`}
              style={{ width: 30, height: 30 }}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12px] font-semibold text-sp-text-dim">{seat.displayName}</span>
              {seat.isHost && (
                <span className="font-sp-font text-[9px] font-bold tracking-[0.06em] text-sp-text-faintest uppercase">Host</span>
              )}
            </span>
            {/* Three states, same footprint so rows never reflow as votes
                land: revealed value, "voted" tick, or waiting. */}
            {seat.showBlank && !seat.isMe && onNudge ? (
              <div className="h-9 w-9 shrink-0">
                <NudgeButton name={seat.displayName} onClick={() => onNudge(seat.id)} disabled={nudgeDisabled} />
              </div>
            ) : <span
              aria-hidden="true"
              className={`flex h-9 shrink-0 items-center justify-center rounded-[5px] font-sp-mono text-[12px] font-bold ${
                seat.showValue && seat.voteValue != null
                  ? 'border border-sp-border-strong bg-sp-card-bg px-1.5 text-sp-text'
                  : seat.showPlaced
                    ? 'border border-sp-border-strong bg-sp-card-bg px-2 text-sp-text-dim'
                    : 'border border-dashed border-sp-border-strong px-2 text-sp-text-faintest'
              }`}
              style={{ minWidth: 36 }}
            >
              {seat.showValue && seat.voteValue != null ? seat.voteValue : seat.showPlaced ? '✓' : '·'}
            </span>}
          </div>
        );
      })}
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

// A handful of distinct fracture shapes -- some tight and spidery, some a
// single long fault line -- so a table with several cracks reads as
// genuinely broken rather than the same sticker stamped down repeatedly at
// different angles. Picked deterministically per crack (see pathIndexFor)
// so every viewer renders the identical decal for the same synced crack.
const CRACK_PATHS = [
  'M17 2 L15 12 L22 14 L13 17 L19 22 L11 21 L14 32 L9 20 L2 24 L8 16 L2 12 L10 13 Z',
  'M3 4 L14 13 L10 9 L16 17 L12 15 L21 24 L17 20 L30 31 M14 13 L20 11 M16 17 L23 18 M21 24 L26 21',
  'M5 30 L11 21 L8 22 L15 12 L12 14 L20 5 L17 9 L29 3 M11 21 L18 23 M15 12 L21 15',
  'M2 17 L10 15 L9 10 L16 13 L15 6 L22 11 L23 3 L28 9 M10 15 L12 22 M16 13 L18 20',
];

function pathIndexFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % CRACK_PATHS.length;
}

// A single crack decal, positioned by fraction (0..1) against whatever
// container it's rendered in -- the table itself when unsplit, or one half
// of it (in that half's own local fraction space) once split. `id` seeds
// which fracture shape renders and how large it is, so the same crack
// looks identical across every client without syncing anything beyond
// what TableCrackEvent already carries.
function TableCrack({ id, fx, fy, rot }: { id: string; fx: number; fy: number; rot: number }) {
  const path = CRACK_PATHS[pathIndexFor(id)];
  // Slightly larger cracks read as later, harder hits -- gives the table's
  // damage a sense of progression rather than every hit leaving an
  // identically-sized mark.
  const size = 30 + (pathIndexFor(id + 'x') % 3) * 6;
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute"
      width={size}
      height={size}
      viewBox="0 0 34 34"
      style={{
        left: `${fx * 100}%`,
        top: `${fy * 100}%`,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        '--cr': `${rot}deg`,
        animation: 'sp-gta-crack-appear 260ms cubic-bezier(.3,1.4,.4,1) both',
      } as StyleVars}
    >
      {/* Faint wide underline first, then the crisp line on top -- reads as
          a groove with depth instead of a single flat stroke. */}
      <path d={path} fill="none" stroke="#000" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" opacity="0.18" />
      <path d={path} fill="none" stroke="var(--sp-border-strong)" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

// Chips of table flying free the instant it actually breaks in two, plus a
// low dust puff -- reuses the exact same debris/smoke building blocks (and
// keyframes) as the car's own explosion in GtaOverlay, scaled down, so the
// table's one dramatic moment doesn't look bare next to it. Centered on the
// table (fractional 0..1 against the table's own box, same convention as
// TableCrack) since the split can be triggered by a hit on either half.
function TableSplitBurst() {
  const debris = debrisPieces(7);
  const smoke = smokePuffs(4);
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {debris.map((d, i) => {
        const big = i % 3 === 0;
        const size = big ? 8 : 5;
        return (
          <div
            key={i}
            className="absolute rounded-[1px]"
            style={{
              left: '50%', top: '50%', width: size, height: size,
              marginLeft: -size / 2, marginTop: -size / 2,
              background: 'color-mix(in oklch, var(--sp-table-center), var(--sp-border-strong) 55%)',
              '--fx': `${d.fx * 0.6}px`, '--fy': `${d.fy * 0.6}px`, '--fr': `${d.fr}deg`,
              animation: `sp-gta-debris ${560 + (big ? 160 : 0)}ms ease-out ${d.delay}ms both`,
            } as StyleVars}
          />
        );
      })}
      {smoke.map((s, i) => {
        const size = 16;
        return (
          <div
            key={`smoke-${i}`}
            className="absolute rounded-full bg-[#847e73]"
            style={{
              left: '50%', top: '50%', width: size, height: size,
              marginLeft: -size / 2, marginTop: -size / 2,
              '--sx': `${s.sx * 0.7}px`, '--sy': `${s.sy * 0.7}px`, '--sr': s.sr,
              animation: `sp-gta-smoke ${900 + (i % 3) * 120}ms ease-out ${s.delay}ms both`,
            } as StyleVars}
          />
        );
      })}
    </div>
  );
}

// Chunks of table knocked loose at the break, sitting in the gap between the
// two halves. Rendered in the *wrapper's* space rather than inside a piece --
// each piece has both overflow-hidden and a clip-path (which clips
// descendants), so anything drawn near a piece's broken edge gets cut away
// exactly where it would be most visible. Living in the wrapper also means
// the rubble stays put while the halves are shoved around, which is what
// sells it as material that fell out rather than decoration stuck to an edge.
//
// Seeded off the synced crack ids via the same pathIndexFor hash the crack
// decals use, so every client renders identical rubble without syncing a
// thing -- the trick TableSplitBurst already relies on.
function TableRubble({ seed }: { seed: string }) {
  const chunks = [
    { y: 12, dx: -3, size: 7 }, { y: 22, dx: 5, size: 5 },
    { y: 31, dx: -6, size: 9 }, { y: 44, dx: 2, size: 6 },
    { y: 53, dx: -4, size: 8 }, { y: 62, dx: 6, size: 5 },
    { y: 74, dx: -2, size: 7 }, { y: 88, dx: 4, size: 6 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {chunks.map((c, i) => {
        const v = pathIndexFor(seed + i);
        const size = c.size + (v % 3);
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: `calc(50% + ${c.dx}px)`,
              top: `${c.y}%`,
              width: size,
              height: size * (0.8 + (v % 3) * 0.15),
              marginLeft: -size / 2,
              background: 'color-mix(in oklch, var(--sp-table-center), var(--sp-border-strong) 62%)',
              // Four irregular quads, picked by the same hash -- no two
              // neighbouring chunks share a silhouette.
              clipPath: [
                'polygon(12% 0, 100% 22%, 84% 100%, 0 72%)',
                'polygon(0 18%, 78% 0, 100% 80%, 22% 100%)',
                'polygon(30% 0, 100% 40%, 62% 100%, 0 58%)',
                'polygon(0 0, 88% 14%, 100% 92%, 16% 76%)',
              ][v],
              // The `rotate` longhand, not a transform -- the settle keyframe
              // animates `transform`, and the two would otherwise clobber
              // each other.
              rotate: `${(v * 37) % 90 - 45}deg`,
              opacity: 0.9,
              animation: `sp-gta-rubble-settle ${300 + (v % 3) * 90}ms ease-out ${40 + i * 22}ms both`,
            }}
          />
        );
      })}
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
  // Who created the room, so their seat can be badged. Optional so the
  // visual-test harness can omit it.
  creatorId?: string;
  isRevealed: boolean;
  anyVote: boolean;
  allVoted: boolean;
  onReveal: () => void;
  onNudge?: (uid: string) => void;
  nudgeDisabled?: boolean;
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
  tableCracks: TableCrackEvent[];
  tablePieceMove: { left: TablePieceMove; right: TablePieceMove };
  tableWasted: WastedMap;
  onPublishDrive: (state: Omit<DriverState, 'uid'>) => void;
  onExitDrive: () => void;
  onPublishCrack: (crack: Omit<TableCrackEvent, 'id' | 'fromUid' | 'ts'>) => void;
  onPublishPieceMove: (side: 'left' | 'right', move: TablePieceMove) => void;
  onMarkWasted: (targetUid: string) => void;
}

export default function SeatTable({
  participants, uid, creatorId, isRevealed, anyVote, allVoted, onReveal, onNudge, nudgeDisabled,
  canTarget, onThrowAt, registerSeatNode, getSeatNode, stageRef, throws, onThrowDone,
  highlightValues = [], bottomClearance: measuredClearance,
  isDriving, forceEndDrive, drivers, tableCracks, tablePieceMove, tableWasted,
  onPublishDrive, onExitDrive, onPublishCrack, onPublishPieceMove, onMarkWasted,
}: SeatTableProps) {
  const active: ParticipantEntry[] = Object.entries(participants).filter(([, p]) => !p.isObserver).sort(byJoinOrder);
  const observers: ParticipantEntry[] = Object.entries(participants).filter(([, p]) => p.isObserver).sort(byJoinOrder);
  const n = active.length;
  const votedCount = active.filter(([, p]) => p.vote != null).length;
  // One breakpoint governs both wide-only behaviors: end seats on the table's
  // short sides, and the vertical observer rail (which drops below the table
  // on narrow viewports so seats keep the full width).
  const wide = useMediaQuery(END_SEAT_BREAKPOINT);
  const { width: viewportWidth, height: viewportHeight } = useViewportSize();
  // How tight the screen is vertically. Phones are excluded: they use a list
  // layout with no table at all, and squeezing their seats further would fix
  // a problem they don't have.
  const shortTier = SHORT_VIEWPORT_TIERS.find(t => viewportHeight >= t.minHeight)!;
  // The shortest band, where the table has already shrunk as far as it usefully
  // can and the remaining savings have to come from the gaps between rows.
  const isTight = viewportHeight > 0 && viewportHeight < TIGHT_VIEWPORT_HEIGHT;
  // Seat size answers to the viewport as well as the headcount, and takes
  // whichever is more constraining. Headcount alone used to decide it, so a
  // 4-person room on a phone kept full 96px seats and wrapped every row into
  // ones and twos -- the "everything crowded together" effect. A big room on
  // a phone still gets the smallest tier: the two rules agree rather than
  // fight, because each only ever shrinks.
  //
  // Viewport *height* is the third input: a wide-but-short laptop has room for
  // full-size seats horizontally and none at all vertically, and the seats are
  // what get pushed off-screen. Like the other two rules, it only ever shrinks.
  const sizes =
    viewportWidth > 0 && viewportWidth < PHONE_MAX_WIDTH ? PHONE_SIZES
    : n >= COMPACT_AT || (viewportWidth > 0 && viewportWidth < COMPACT_MAX_WIDTH) ? COMPACT_SIZES
    : viewportHeight > 0 && shortTier.compactSeats ? COMPACT_SIZES
    : DEFAULT_SIZES;
  const isPhone = sizes === PHONE_SIZES;

  // seatId -> timestamp of its most recent GTA Mode hit, from any driver
  // (ours or a remote one) -- read by every viewer, not just the one
  // currently driving, so a bystander sees the same squash the driver caused.
  // SeatTable has no rAF loop of its own (unlike GtaOverlay), so each entry
  // is cleared by its own timer rather than relying on some other re-render
  // to notice the animation has finished -- otherwise the seat would carry a
  // stale 'squash'/'wobble' animation value indefinitely between hits.
  const [wobbling, setWobbling] = useState<Record<string, number>>({});
  const [squashed, setSquashed] = useState<Record<string, number>>({});
  // Table damage (cracks/piece-shove/wasted) is synced via RTDB under
  // gtaTable/$roomCode (see roomStore.gta.ts) so every viewer sees the same
  // table condition, not just whoever's car caused it -- these come in as
  // props rather than local state. wobbling/squashed above stay local-only:
  // they're purely cosmetic per-render animation timers, and a remote hit
  // already retriggers them independently via the `drivers[x].hit` watcher
  // below, the same as it always has.
  const tableSplit = tableCracks.length >= TABLE_SPLIT_THRESHOLD;
  // Cracks landed on the intact table carry side 'table'; ones landed after
  // the split carry 'left'/'right'. Each half used to render only its own
  // side, so at the moment of the break the very cracks that caused it all
  // vanished -- the table visibly healed as it snapped in two.
  //
  // A 'table' crack's fx is a fraction of the whole surface, so which half it
  // belongs to is just which side of the midline it sits on, and its position
  // within that half is that fraction rescaled to 0..1. Derived rather than
  // rewritten into state: the stored events stay exactly as published (every
  // client re-derives the same thing), and nothing has to be migrated.
  const cracksFor = (side: 'left' | 'right') =>
    tableCracks.flatMap(c => {
      if (c.side === side) return [c];
      if (c.side !== 'table') return [];
      const onLeft = c.fx < 0.5;
      if (onLeft !== (side === 'left')) return [];
      return [{ ...c, fx: onLeft ? c.fx * 2 : (c.fx - 0.5) * 2 }];
    });
  // One-shot debris/dust burst the instant the table crosses into split --
  // every viewer derives tableSplit independently from the same synced
  // crack count, so this fires identically everywhere with no extra sync,
  // the same trick debrisPieces/smokePuffs already rely on for the car's
  // own explosion. Torn down after SPLIT_BURST_MS so it doesn't linger as
  // dead DOM for the rest of the round.
  const [splitBurst, setSplitBurst] = useState(false);
  const wasSplitRef = useRef(tableSplit);
  useEffect(() => {
    if (tableSplit && !wasSplitRef.current) {
      setSplitBurst(true);
      const t = setTimeout(() => setSplitBurst(false), SPLIT_BURST_MS);
      wasSplitRef.current = true;
      return () => clearTimeout(t);
    }
    wasSplitRef.current = tableSplit;
  }, [tableSplit]);
  // Our own vacated state, reported directly by GtaOverlay off local phase
  // (not the RTDB round-trip) -- otherwise the seat's own avatar stays
  // visible, duplicated alongside the car, for however long that write
  // takes to land. Everyone else's vacated state (see `seats` below) reads
  // their streamed `phase` instead, now that position/phase publish from
  // the moment a drive starts arriving, not just once actually driving.
  const [myVacated, setMyVacated] = useState(false);
  const now = performance.now();

  // How far one hit shoves an already-split piece, and the cap on how far it
  // can be pushed in total -- capped so a piece can be rammed repeatedly
  // without ever leaving the board or ending up somewhere collision math
  // (still just its DOM rect) can't reasonably represent.
  const PIECE_SHOVE_PX = 7;
  const PIECE_SHOVE_MAX_PX = 46;
  const PIECE_SHOVE_ROT_DEG = 3;
  const PIECE_SHOVE_MAX_ROT_DEG = 22;

  // handleTableHit is called from inside GtaOverlay's rAF loop, whose
  // closure over onTableHit is captured once at mount (see GtaOverlay's own
  // useLayoutEffect deps) and never refreshed -- so reading tablePieceMove
  // directly here would compute every shove increment on top of the value
  // from that first render. A ref sidesteps it, the same fix
  // remoteDriversRef/wastedIdsRef already apply in GtaOverlay for the same
  // stale-closure shape.
  const tablePieceMoveRef = useRef(tablePieceMove);
  tablePieceMoveRef.current = tablePieceMove;
  // The visual halves, kept separately from the collision proxies registered
  // under __table__left/__table__right: cracks have to be placed against the
  // rect the player actually sees, while the car collides with a simpler
  // unrotated box (see the split render below).
  const pieceNodesRef = useRef<{ left: HTMLElement | null; right: HTMLElement | null }>({ left: null, right: null });
  // Same stale-closure reason as tablePieceMoveRef above.
  const crackCountRef = useRef(tableCracks.length);
  crackCountRef.current = tableCracks.length;
  const lastTableHitRef = useRef(0);

  const handleTableHit = (tableId: string, stageX: number, stageY: number, impactDx: number, impactDy: number) => {
    const stageNode = stageRef.current;
    if (!stageNode) return;
    // stepCar reports a hit every frame the car is still overlapping at
    // speed, so one ram would otherwise publish a burst of near-identical
    // cracks (an RTDB write each) and could cross the split threshold on its
    // own. One ram should read as one hit.
    const nowMs = performance.now();
    if (nowMs - lastTableHitRef.current < TABLE_HIT_COOLDOWN_MS) return;
    lastTableHitRef.current = nowMs;
    const atCrackCap = crackCountRef.current >= TABLE_CRACK_CAP;
    const sb = stageNode.getBoundingClientRect();

    if (tableId === '__table__') {
      if (atCrackCap) return;
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
      //
      // Kept deliberately small. A larger margin (a full decal radius) does
      // stop the corners clipping, but it drags every hit inward from where
      // the car actually touched -- and a crack appearing away from the point
      // of impact reads as broken far more than a decal overhanging a rounded
      // corner does. The damage marking the contact point is the whole effect.
      const margin = CRACK_EDGE_MARGIN;
      const px = Math.min(tb.width - margin, Math.max(margin, stageX + sb.left - tb.left));
      const py = Math.min(tb.height - margin, Math.max(margin, stageY + sb.top - tb.top));
      onPublishCrack({ fx: px / tb.width, fy: py / tb.height, rot: Math.round(Math.random() * 360), side: 'table' });
      return;
    }

    // A piece hit after the split: place the crack in that piece's own live
    // rect, and shove the piece further away along the impact direction. The
    // crack goes on the *visual* half, not the collision proxy -- they're
    // deliberately different boxes.
    const side: 'left' | 'right' = tableId === '__table__left' ? 'left' : 'right';
    const pieceNode = pieceNodesRef.current[side];
    if (pieceNode && !atCrackCap) {
      const pb = pieceNode.getBoundingClientRect();
      if (pb.width > 0 && pb.height > 0) {
        const margin = CRACK_EDGE_MARGIN;
        const px = Math.min(pb.width - margin, Math.max(margin, stageX + sb.left - pb.left));
        const py = Math.min(pb.height - margin, Math.max(margin, stageY + sb.top - pb.top));
        onPublishCrack({ fx: px / pb.width, fy: py / pb.height, rot: Math.round(Math.random() * 360), side });
      }
    }
    const cur = tablePieceMoveRef.current[side];
    const nextX = Math.max(-PIECE_SHOVE_MAX_PX, Math.min(PIECE_SHOVE_MAX_PX, cur.x + impactDx * PIECE_SHOVE_PX));
    const nextY = Math.max(-PIECE_SHOVE_MAX_PX, Math.min(PIECE_SHOVE_MAX_PX, cur.y + impactDy * PIECE_SHOVE_PX));
    // Rotation direction alternates with which way the piece is being hit
    // (impactDx sign), so repeated hits from the same side keep twisting
    // the same way rather than fighting themselves back to level.
    const rotDelta = (impactDx >= 0 ? 1 : -1) * PIECE_SHOVE_ROT_DEG * (side === 'left' ? -1 : 1);
    const nextRot = Math.max(-PIECE_SHOVE_MAX_ROT_DEG, Math.min(PIECE_SHOVE_MAX_ROT_DEG, cur.rot + rotDelta));
    onPublishPieceMove(side, { x: nextX, y: nextY, rot: nextRot });
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
  const occupancyRef = useRef({ myVacated, drivers });
  occupancyRef.current = { myVacated, drivers };
  const handleSeatSquash = (seatId: string, publish = true) => {
    const stamp = performance.now();
    setSquashed(s => ({ ...s, [seatId]: stamp }));
    setTimeout(() => setSquashed(s => {
      if (s[seatId] !== stamp) return s;
      const rest = { ...s };
      delete rest[seatId];
      return rest;
    }), SQUASH_MS);
    // A driver can't be wasted by getting squashed -- they're in a car, not
    // sitting in the seat that just got hit.
    const current = occupancyRef.current;
    const targetVacated = seatId === uid ? current.myVacated
      : !!current.drivers[seatId] && current.drivers[seatId].phase !== 'idle';
    if (publish && !targetVacated) onMarkWasted(seatId);
  };

  // Remote drivers report their hit target on the streamed position payload
  // (see roomStore.gta.ts), re-publishing the same value for as long as it
  // stays true -- track what we've already animated per uid so a held hit
  // triggers the animation once, not every throttled tick.
  const lastRemoteHitRef = useRef<Record<string, string | null | undefined>>({});
  useEffect(() => {
    for (const d of Object.values(drivers)) {
      if (d.hit && d.hit !== lastRemoteHitRef.current[d.uid]) handleSeatSquash(d.hit, false);
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
      isHost: !!creatorId && id === creatorId,
      avatarUrl: participantAvatarSrc(p),
      size: isMe ? sizes.meAvatar : sizes.avatar,
      displayName: isMe ? p.name + ' (you)' : p.name,
      showBlank: !hasVoted,
      showPlaced: !isRevealed && hasVoted,
      showValue: isRevealed && hasVoted,
      voteValue: p.vote,
      // Our own seat uses GtaOverlay's direct local signal (instant, no
      // network round-trip); everyone else's uses their streamed phase.
      vacated: isMe ? myVacated : !!drivers[id] && seatVacated(drivers[id].phase as GtaPhase),
      hitAnimation: hitAnimationFor(id),
      squashAt: squashAtFor(id),
      wasted: id in tableWasted,
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
  // The lower floor can't be a flat 360px: the stage's own px-4 leaves 358px
  // of content on a 390px phone, so a 360px floor asked for more room than
  // exists and every row wrapped. Cap it to what the viewport can actually
  // give (0 while the width is still unmeasured, e.g. jsdom).
  const availableWidth = viewportWidth > 0 ? viewportWidth - STAGE_H_PADDING : Infinity;
  const baseFloor = Math.min(360, availableWidth);
  const stageMaxWidth = Math.min(
    STAGE_MAX_CAP,
    Math.max(baseFloor, widthFloor, widestRow * (sizes.seatW + SEAT_GAP) + 48),
    availableWidth,
  );
  // Width picks the table's natural height; the short-viewport tier then
  // scales it down so the seat rows below it stay on screen. Phones keep the
  // width-derived value untouched -- they render no table at all.
  const baseTableHeight = HEIGHT_BREAKPOINTS.find(b => viewportWidth >= b.minWidth)!.height;
  const tableHeight =
    isPhone || viewportHeight === 0
      ? baseTableHeight
      : Math.max(MIN_TABLE_HEIGHT, Math.round(baseTableHeight * shortTier.tableScale));
  // Clearance for the fixed VotingBar is the bar's real measured height
  // (plus a small buffer) rather than a guess, so it only ever changes by
  // as much as the bar actually grows/shrinks — and that change transitions
  // smoothly (see padding-bottom transition below) instead of snapping,
  // so the table doesn't visibly jump when the distribution panel appears.
  const bottomClearance = (measuredClearance || CLEARANCE_FALLBACK) + CLEARANCE_BUFFER;
  const seatProps = { canTarget, onThrowAt, registerSeatNode, sizes, onNudge: isRevealed ? undefined : onNudge, nudgeDisabled };

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
        // justify-center only while there's room to spare: once the content
        // plus the voting bar's clearance exceeds the viewport, centring
        // overflows at BOTH ends, so the bottom seat row disappears behind
        // the bar with no way to scroll to it. Falling back to start-aligned
        // keeps every seat reachable on a short screen.
        className={`flex min-w-0 flex-1 flex-col items-center px-4 transition-[padding-bottom] duration-250 ${isTight ? 'pt-2' : 'pt-5'} ${isPhone ? 'justify-start' : 'justify-center'}`}
        style={{ paddingBottom: bottomClearance }}
      >
        {isPhone ? (
          // No table on a phone: GTA Mode is desktop-only (it needs a
          // keyboard), so nothing here depends on the table existing, and the
          // vote counter and Reveal button it used to hold read better as a
          // proper action row anyway.
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span aria-hidden="true" className="font-sp-mono text-[13px] font-bold text-sp-text-dim">
                {isRevealed ? `Votes revealed · ${votedCount}/${n} voted` : `${votedCount}/${n} voted`}
              </span>
              {!isRevealed && (
                <button
                  onClick={onReveal}
                  disabled={!anyVote}
                  className={`min-h-[44px] rounded-lg border-none bg-sp-accent px-5 font-sp-font text-sm font-bold text-sp-bg ${anyVote ? 'opacity-100' : 'cursor-default opacity-45'}`}
                >Reveal votes</button>
              )}
            </div>
            <ParticipantGrid
              seats={seats}
              onNudge={isRevealed ? undefined : onNudge}
              nudgeDisabled={nudgeDisabled}
              canTarget={canTarget}
              onThrowAt={onThrowAt}
              registerSeatNode={registerSeatNode}
            />
            {/* The visual counter above is aria-hidden, so round progress is
                narrated here instead. */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {isRevealed ? `Votes revealed · ${votedCount}/${n} voted` : `${votedCount} of ${n} ${n === 1 ? 'person has' : 'people have'} voted`}
            </div>
          </div>
        ) : (
        <div className={`flex w-full flex-col ${isTight ? 'gap-2' : 'gap-4.5'}`} style={{ maxWidth: stageMaxWidth }}>
          <SeatRow seats={top} {...seatProps} />

          <div className="flex items-center gap-4">
            {leftEnd && <Seat seat={leftEnd} {...seatProps} />}
            <div
              // Once split, this wrapper stops being a collidable thing --
              // its two pieces are. Registering it anyway would leave a
              // full-width phantom box that wins every collision, since
              // stepCar takes the first overlapping obstacle and the table
              // sorts ahead of the seats.
              ref={node => registerSeatNode('__table__', tableSplit ? null : node)}
              className={`relative flex flex-1 items-center justify-center rounded-[28px] transition-[border-color,box-shadow] duration-150 ${
                tableSplit ? '' : `sp-table-surface overflow-hidden bg-sp-table-center ${!isRevealed && allVoted ? 'sp-ready-pulse border-2 border-sp-accent' : 'border border-sp-border'}`
              }`}
              style={{ minWidth: isPhone ? PHONE_TABLE_MIN_WIDTH : TABLE_MIN_WIDTH, height: tableHeight }}
            >
              {/* GTA Mode: once enough cracks land, the table splits into two
                  separate pieces -- each keeps its own rounded outer corners
                  and border, with the inner (broken) edge carved by a shared
                  irregular fracture line (see tableFracture.ts) so the two
                  halves interlock like something that actually snapped.
                  Each piece is now also its own obstacle in obstacleIds
                  above: getting hit again shoves it further via pieceMove
                  (a small discrete offset + rotation per hit, capped), so it
                  keeps skidding away and keeps blocking the car from
                  wherever it ends up -- a real, independently-hittable
                  entity, not just a one-time settle animation.
                  Depth at the break comes from the pieces themselves -- an
                  inset shadow along each broken edge, and a fill nudged
                  darker than the intact table's (via color-mix) so "broken"
                  carries a material change, not just a shape change. There's
                  deliberately nothing painted in the gap: you see straight
                  through to the page, which is what a real hole looks like.
                  Loose chunks knocked out of the break sit in that gap (see
                  TableRubble). */}
              {tableSplit ? (
                <>
                  {splitBurst && <TableSplitBurst />}
                  {/* Each piece owns its cracks as children in its own local
                      coordinate space (0..1 across just that piece), so a
                      crack lands on solid material and travels with the
                      piece as pieceMove shoves it around. */}
                  <div
                    ref={node => { pieceNodesRef.current.left = node; }}
                    data-table-piece="left"
                    aria-hidden="true"
                    className="absolute top-0 bottom-0 left-0 overflow-hidden border border-sp-border"
                    style={{
                      // Only a hair past halfway: the pieces must not overlap
                      // much, or their collision rects (plain bounding boxes,
                      // clip-path invisible to them) would meet in mid-gap and
                      // stop the car in what looks like open space.
                      width: 'calc(50% + 2px)',
                      borderTopLeftRadius: 28,
                      borderBottomLeftRadius: 28,
                      background: 'color-mix(in oklch, var(--sp-table-center), var(--sp-border-strong) 12%)',
                      boxShadow: 'inset -14px 0 16px -10px rgba(0,0,0,0.55), 5px 2px 12px rgba(0,0,0,0.26)',
                      clipPath: fracturePolygon('left'),
                      // The resting offset (plus every pieceMove shove) lives
                      // here and only here. The entry keyframes animate the
                      // translate/rotate longhands instead, which compose
                      // with this rather than replacing it -- so a hit
                      // landing mid-animation still moves the piece, which it
                      // did not when the keyframe hardcoded its own endpoint.
                      transform: `translate(${-15 + tablePieceMove.left.x}px, ${2 + tablePieceMove.left.y}px) rotate(${-5.2 + tablePieceMove.left.rot}deg)`,
                      transition: 'transform 220ms cubic-bezier(.2,.7,.3,1)',
                      animation: 'sp-gta-table-split-left 520ms cubic-bezier(.34,1.24,.5,1) both',
                    }}
                  >
                    {cracksFor('left').map(c => (
                      <TableCrack key={c.id} id={c.id} fx={c.fx} fy={c.fy} rot={c.rot} />
                    ))}
                  </div>
                  <div
                    ref={node => { pieceNodesRef.current.right = node; }}
                    data-table-piece="right"
                    aria-hidden="true"
                    className="absolute top-0 right-0 bottom-0 overflow-hidden border border-sp-border"
                    style={{
                      width: 'calc(50% + 2px)',
                      borderTopRightRadius: 28,
                      borderBottomRightRadius: 28,
                      background: 'color-mix(in oklch, var(--sp-table-center), var(--sp-border-strong) 12%)',
                      boxShadow: 'inset 14px 0 16px -10px rgba(0,0,0,0.55), -5px 2px 12px rgba(0,0,0,0.26)',
                      clipPath: fracturePolygon('right'),
                      transform: `translate(${15 + tablePieceMove.right.x}px, ${3 + tablePieceMove.right.y}px) rotate(${4.1 + tablePieceMove.right.rot}deg)`,
                      transition: 'transform 220ms cubic-bezier(.2,.7,.3,1)',
                      animation: 'sp-gta-table-split-right 520ms cubic-bezier(.34,1.24,.5,1) both',
                    }}
                  >
                    {cracksFor('right').map(c => (
                      <TableCrack key={c.id} id={c.id} fx={c.fx} fy={c.fy} rot={c.rot} />
                    ))}
                  </div>
                  <TableRubble seed={tableCracks[0]?.id ?? 'r'} />
                  {/* Collision proxies. The pieces themselves are rotated and
                      clip-path'd, and getBoundingClientRect sees neither --
                      it returns the rotated element's inflated bounding box,
                      including the void the fracture carves out. These
                      unrotated boxes, inset to sit under the solid part of
                      each half, are what the car actually collides with, so
                      the physics matches what's on screen.

                      They carry the same translate as their piece (rotation
                      deliberately omitted -- a rotated box only inflates the
                      rect back again), so a shoved half stays collidable
                      where it now sits rather than leaving its hitbox behind
                      at the original position. No transition either: physics
                      should track the piece's destination immediately, not
                      lag through the 220ms visual ease. */}
                  <div
                    ref={node => registerSeatNode('__table__left', node)}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 bottom-0 left-0"
                    style={{
                      width: 'calc(50% - 16px)',
                      transform: `translate(${-15 + tablePieceMove.left.x}px, ${2 + tablePieceMove.left.y}px)`,
                    }}
                  />
                  <div
                    ref={node => registerSeatNode('__table__right', node)}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 right-0 bottom-0"
                    style={{
                      width: 'calc(50% - 16px)',
                      transform: `translate(${15 + tablePieceMove.right.x}px, ${3 + tablePieceMove.right.y}px)`,
                    }}
                  />
                </>
              ) : (
                // GTA Mode: cracks left by the car ramming the table, pinned
                // as fractions of the table's own box so they stay put as it
                // resizes. Purely decorative, so it's excluded from the a11y tree.
                tableCracks.filter(c => c.side === 'table').map(c => <TableCrack key={c.id} id={c.id} fx={c.fx} fy={c.fy} rot={c.rot} />)
              )}

              {/* The visual vote counter and the reveal are otherwise silent to
                  a screen reader -- this narrates round progress instead. */}
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {isRevealed
                  ? `Votes revealed · ${votedCount}/${n} voted`
                  : `${votedCount} of ${n} ${n === 1 ? 'person has' : 'people have'} voted`}
              </div>

              {isRevealed && (
                <div className="relative text-center text-xs text-sp-text-dim">
                  <div className="font-semibold">{votedCount}/{n} voted</div>
                  {votedCount < n && <div className="mt-1">Still accepting votes</div>}
                </div>
              )}
              {!isRevealed && (
                <div className="relative flex flex-col items-center gap-2">
                  <div aria-hidden="true" className="font-sp-mono text-[13px] font-bold text-sp-text-dim">{votedCount}/{n}</div>
                  <button
                    onClick={onReveal}
                    disabled={!anyVote}
                    className={`rounded-lg border-none bg-sp-accent px-5 py-2.5 font-sp-font text-sm font-bold text-sp-bg ${anyVote ? 'cursor-pointer' : 'cursor-default opacity-45'}`}
                  >Reveal votes</button>
                </div>
              )}
            </div>
            {rightEnd && <Seat seat={rightEnd} {...seatProps} />}
          </div>

          <SeatRow seats={bottom} reverse {...seatProps} />

          {!wide && <ObserverRail horizontal observers={observers} uid={uid} canTarget={canTarget} onThrowAt={onThrowAt} registerSeatNode={registerSeatNode} />}
        </div>
        )}

        {/* The phone branch above has no room for the seat-flanking rail, so
            observers hang below the grid instead -- still present, just not
            competing with the participants for width. */}
        {isPhone && observers.length > 0 && (
          <div className="mt-3 w-full">
            <ObserverRail horizontal observers={observers} uid={uid} canTarget={canTarget} onThrowAt={onThrowAt} registerSeatNode={registerSeatNode} />
          </div>
        )}
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
          wastedIds={new Set(Object.keys(tableWasted))}
          getSeatNode={getSeatNode}
          stageNode={stageRef.current}
          // The stage box runs the full height of the column, which extends
          // underneath the fixed voting bar -- so without this the car's own
          // bounds let it drive down behind the results panel and vanish.
          bottomInset={bottomClearance}
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
