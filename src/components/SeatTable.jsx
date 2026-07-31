import { participantAvatarSrc } from '../lib/avatar.js';
import useMediaQuery from '../lib/useMediaQuery.js';
import ObserverRail from './ObserverRail.jsx';
import ThrowOverlay from './ThrowOverlay.jsx';

function byJoinOrder([, a], [, b]) {
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
const TABLE_HEIGHT = 170;
const TABLE_MIN_WIDTH = 200;
const END_SEAT_BREAKPOINT = '(min-width: 640px)';

// Index-based so nobody reshuffles when someone joins (new joiners sort last
// by joinedAt). Ends are pinned to indices 2 and 3; everyone else alternates
// bottom/top, keeping the rows balanced within one seat.
function distributeSeats(seats, useEnds) {
  const top = [];
  const bottom = [];
  let leftEnd = null;
  let rightEnd = null;
  seats.forEach((seat, idx) => {
    if (useEnds && idx === 2) { leftEnd = seat; return; }
    if (useEnds && idx === 3) { rightEnd = seat; return; }
    (idx % 2 === 0 ? bottom : top).push(seat);
  });
  return { top, bottom, leftEnd, rightEnd };
}

// reverse flips the column so the vote card sits adjacent to the table on the
// bottom row.
function Seat({ seat, reverse, canTarget, onThrowAt, registerSeatNode, sizes }) {
  const canClick = canTarget && !seat.isMe;
  // Dimmed, not the highlighted ones themselves, is what carries the contrast:
  // fading every other seat makes the highlighted group unmissable regardless
  // of vote-card color, instead of relying on a subtle ring around cards that
  // are already accent-colored.
  const dimmed = seat.dimmed;
  return (
    <div style={{ width: sizes.seatW, flexShrink: 0, display: 'flex', flexDirection: reverse ? 'column-reverse' : 'column', alignItems: 'center', gap: 8, opacity: dimmed ? 0.35 : 1, transition: 'opacity 0.15s ease' }}>
      <img
        ref={node => registerSeatNode(seat.id, node)}
        src={seat.avatarUrl}
        alt=""
        onClick={canClick ? (e) => onThrowAt(seat.id, e) : undefined}
        style={{ width: seat.size, height: seat.size, borderRadius: '50%', display: 'block', background: 'var(--sp-card-bg)', border: '1px solid var(--sp-border)', cursor: canClick ? 'crosshair' : 'default' }}
      />
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sp-text-dim)', maxWidth: sizes.seatW - 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{seat.displayName}</div>

      {seat.showBlank && (
        <div style={{ width: sizes.cardW, height: sizes.cardH, borderRadius: 5, background: 'var(--sp-card-bg)', border: '1.5px solid var(--sp-border-strong)' }} />
      )}
      {(seat.showPlaced || seat.showValue) && (
        <div style={{ width: sizes.cardW, height: sizes.cardH, perspective: 300 }}>
          {seat.showValue ? (
            <div
              className="sp-flip-card"
              style={{ width: '100%', height: '100%', animationDelay: `${seat.flipDelay}ms` }}
            >
              <div className="sp-flip-face" style={{ width: sizes.cardW, height: sizes.cardH, borderRadius: 5, background: 'var(--sp-accent-panel)', border: '2px solid var(--sp-accent)', color: 'var(--sp-accent-text)', fontFamily: 'var(--sp-mono)', fontSize: sizes.cardFont, fontWeight: 700 }}>?</div>
              <div className="sp-flip-face sp-flip-face-back" style={{ width: sizes.cardW, height: sizes.cardH, borderRadius: 5, background: 'var(--sp-accent-panel)', border: '2px solid var(--sp-accent)', color: 'var(--sp-accent-on-card)', fontFamily: 'var(--sp-mono)', fontSize: sizes.cardFont, fontWeight: 700 }}>{seat.voteValue}</div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: 5, background: 'var(--sp-accent-panel)', border: '2px solid var(--sp-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sp-accent-text)', fontFamily: 'var(--sp-mono)', fontSize: sizes.cardFont, fontWeight: 700 }}>?</div>
          )}
        </div>
      )}
    </div>
  );
}

function SeatRow({ seats, reverse, ...seatProps }) {
  if (seats.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: reverse ? 'flex-start' : 'flex-end', gap: `14px ${SEAT_GAP}px` }}>
      {seats.map(seat => <Seat key={seat.id} seat={seat} reverse={reverse} {...seatProps} />)}
    </div>
  );
}

export default function SeatTable({
  participants, uid, isRevealed, anyVote, allVoted, onReveal,
  canTarget, onThrowAt, registerSeatNode, getSeatNode, stageRef, throws, onThrowDone,
  highlightValues = [],
}) {
  const active = Object.entries(participants).filter(([, p]) => !p.isObserver).sort(byJoinOrder);
  const observers = Object.entries(participants).filter(([, p]) => p.isObserver).sort(byJoinOrder);
  const n = active.length;
  const votedCount = active.filter(([, p]) => p.vote != null).length;
  // One breakpoint governs both wide-only behaviors: end seats on the table's
  // short sides, and the vertical observer rail (which drops below the table
  // on narrow viewports so seats keep the full width).
  const wide = useMediaQuery(END_SEAT_BREAKPOINT);
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
  const stageMaxWidth = Math.min(STAGE_MAX_CAP, Math.max(360, widestRow * (sizes.seatW + SEAT_GAP) + 48));
  // Clearance for the fixed VotingBar, which is much taller when the
  // distribution panel renders after reveal.
  const bottomClearance = isRevealed ? 300 : 120;
  const seatProps = { canTarget, onThrowAt, registerSeatNode, sizes };

  return (
    // The stage contains every throwable avatar (seats and observers), so
    // ThrowOverlay's rect math is valid for all targets.
    <div ref={stageRef} style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'row', minWidth: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, padding: `20px 16px ${bottomClearance}px` }}>
        <div style={{ width: '100%', maxWidth: stageMaxWidth, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SeatRow seats={top} {...seatProps} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {leftEnd && <Seat seat={leftEnd} {...seatProps} />}
            <div
              style={{
                flex: 1, minWidth: TABLE_MIN_WIDTH, height: TABLE_HEIGHT, borderRadius: 28, background: 'var(--sp-table-center)',
                border: !isRevealed && allVoted ? '2px solid var(--sp-accent)' : '1px solid var(--sp-border)',
                boxShadow: !isRevealed && allVoted ? '0 0 0 3px var(--sp-accent-glow)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              {!isRevealed && (
                allVoted ? (
                  <button
                    onClick={onReveal}
                    disabled={!anyVote}
                    style={{
                      background: 'var(--sp-accent)', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'var(--sp-bg)',
                      fontFamily: 'var(--sp-font)', fontSize: 13, fontWeight: 700, cursor: anyVote ? 'pointer' : 'default', opacity: anyVote ? 1 : 0.45,
                    }}
                  >Reveal votes</button>
                ) : (
                  <div style={{ fontFamily: 'var(--sp-mono)', fontSize: 15, fontWeight: 700, color: 'var(--sp-text-dim)' }}>
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
