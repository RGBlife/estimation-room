function byJoinOrder([, a], [, b]) {
  return (a.joinedAt ?? 0) - (b.joinedAt ?? 0);
}

// Base layout comfortably fits 8 seats. Beyond that, grow the table and
// shrink avatars so seats stay evenly spaced without overlapping.
const BASE_SEAT_COUNT = 8;
const BASE_MAX_WIDTH = 820;
const BASE_HEIGHT = 420;
const BASE_AVATAR_SIZE = 52;
const BASE_ME_AVATAR_SIZE = 60;
const MIN_AVATAR_SIZE = 34;
const MIN_ME_AVATAR_SIZE = 38;
const BASE_CARD_WIDTH = 34;
const BASE_CARD_HEIGHT = 48;
const MIN_CARD_WIDTH = 24;
const MIN_CARD_HEIGHT = 34;
const BASE_NAME_WIDTH = 100;
const MIN_NAME_WIDTH = 68;

export default function SeatTable({ participants, uid, roomCode, isRevealed }) {
  const active = Object.entries(participants).filter(([, p]) => !p.isObserver).sort(byJoinOrder);
  const observers = Object.entries(participants).filter(([, p]) => p.isObserver).sort(byJoinOrder);
  const n = active.length;

  const growth = Math.max(1, n / BASE_SEAT_COUNT);
  const tableMaxWidth = Math.round(BASE_MAX_WIDTH * Math.min(growth, 1.8));
  const tableHeight = Math.round(BASE_HEIGHT * Math.min(growth, 1.6));
  const shrink = n > BASE_SEAT_COUNT ? BASE_SEAT_COUNT / n : 1;
  const avatarSize = Math.max(MIN_AVATAR_SIZE, Math.round(BASE_AVATAR_SIZE * shrink));
  const meAvatarSize = Math.max(MIN_ME_AVATAR_SIZE, Math.round(BASE_ME_AVATAR_SIZE * shrink));
  const cardWidth = Math.max(MIN_CARD_WIDTH, Math.round(BASE_CARD_WIDTH * shrink));
  const cardHeight = Math.max(MIN_CARD_HEIGHT, Math.round(BASE_CARD_HEIGHT * shrink));
  const nameWidth = Math.max(MIN_NAME_WIDTH, Math.round(BASE_NAME_WIDTH * shrink));

  const seats = active.map(([id, p], idx) => {
    const thetaDeg = 180 + idx * (360 / Math.max(n, 1));
    const thetaRad = thetaDeg * Math.PI / 180;
    const left = 50 + 44 * Math.sin(thetaRad);
    const top = 50 - 32 * Math.cos(thetaRad);
    const isMe = id === uid;
    const hasVoted = p.vote != null;
    return {
      id, isMe,
      avatarUrl: p.avatarUrl,
      size: isMe ? meAvatarSize : avatarSize,
      displayName: isMe ? p.name + ' (you)' : p.name,
      leftPct: left.toFixed(1) + '%',
      topPct: top.toFixed(1) + '%',
      showBlank: !isRevealed && !hasVoted,
      showPlaced: !isRevealed && hasVoted,
      showValue: isRevealed,
      voteValue: p.vote,
    };
  });

  const cardFontSize = Math.max(11, Math.round(16 * shrink));

  return (
    <>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 20px 150px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: tableMaxWidth, height: tableHeight }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '58%', height: '52%', borderRadius: '50%', background: 'oklch(0.23 0.02 260)', border: '1px solid var(--sp-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--sp-mono)', fontSize: 12, color: 'oklch(0.4 0.01 260)' }}>{roomCode}</span>
          </div>

          {seats.map(seat => (
            <div key={seat.id} style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, left: seat.leftPct, top: seat.topPct, transform: 'translate(-50%,-50%)' }}>
              <img src={seat.avatarUrl} alt="" style={{ width: seat.size, height: seat.size, borderRadius: '50%', display: 'block', background: 'oklch(0.19 0.012 260)', border: '1px solid var(--sp-border)' }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sp-text-dim)', maxWidth: nameWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{seat.displayName}</div>

              {seat.showBlank && (
                <div style={{ width: cardWidth, height: cardHeight, borderRadius: 5, background: 'oklch(0.19 0.012 260)', border: '1.5px solid var(--sp-border-strong)' }} />
              )}
              {seat.showPlaced && (
                <div style={{ width: cardWidth, height: cardHeight, borderRadius: 5, background: 'var(--sp-accent-panel)', border: '2px solid var(--sp-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sp-accent-text)', fontFamily: 'var(--sp-mono)', fontSize: cardFontSize, fontWeight: 700 }}>?</div>
              )}
              {seat.showValue && (
                <div style={{ width: cardWidth, height: cardHeight, borderRadius: 5, background: 'var(--sp-accent-panel)', border: '2px solid var(--sp-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.95 0.01 265)', fontFamily: 'var(--sp-mono)', fontSize: cardFontSize, fontWeight: 700 }}>{seat.voteValue}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {observers.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 20px 20px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--sp-text-faintest)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Observing</span>
          {observers.map(([id, p]) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.6 }}>
              <img src={p.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', display: 'block' }} />
              <span style={{ fontSize: 12, color: 'var(--sp-text-dim)' }}>{id === uid ? p.name + ' (you)' : p.name}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
