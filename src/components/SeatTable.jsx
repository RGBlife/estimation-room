function byJoinOrder([, a], [, b]) {
  return (a.joinedAt ?? 0) - (b.joinedAt ?? 0);
}

export default function SeatTable({ participants, uid, roomCode, isRevealed }) {
  const active = Object.entries(participants).filter(([, p]) => !p.isObserver).sort(byJoinOrder);
  const observers = Object.entries(participants).filter(([, p]) => p.isObserver).sort(byJoinOrder);
  const n = active.length;

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
      size: isMe ? 60 : 52,
      displayName: isMe ? p.name + ' (you)' : p.name,
      leftPct: left.toFixed(1) + '%',
      topPct: top.toFixed(1) + '%',
      showBlank: !isRevealed && !hasVoted,
      showPlaced: !isRevealed && hasVoted,
      showValue: isRevealed,
      voteValue: p.vote,
    };
  });

  return (
    <>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 20px 150px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 820, height: 420 }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '58%', height: '52%', borderRadius: '50%', background: 'oklch(0.23 0.02 260)', border: '1px solid var(--sp-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--sp-mono)', fontSize: 12, color: 'oklch(0.4 0.01 260)' }}>{roomCode}</span>
          </div>

          {seats.map(seat => (
            <div key={seat.id} style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, left: seat.leftPct, top: seat.topPct, transform: 'translate(-50%,-50%)' }}>
              <img src={seat.avatarUrl} alt="" style={{ width: seat.size, height: seat.size, borderRadius: '50%', display: 'block', background: 'oklch(0.19 0.012 260)', border: '1px solid var(--sp-border)' }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sp-text-dim)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{seat.displayName}</div>

              {seat.showBlank && (
                <div style={{ width: 34, height: 48, borderRadius: 5, background: 'oklch(0.19 0.012 260)', border: '1.5px solid var(--sp-border-strong)' }} />
              )}
              {seat.showPlaced && (
                <div style={{ width: 34, height: 48, borderRadius: 5, background: 'var(--sp-accent-panel)', border: '2px solid var(--sp-accent)' }} />
              )}
              {seat.showValue && (
                <div style={{ width: 34, height: 48, borderRadius: 5, background: 'var(--sp-accent-panel)', border: '2px solid var(--sp-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.95 0.01 265)', fontFamily: 'var(--sp-mono)', fontSize: 16, fontWeight: 700 }}>{seat.voteValue}</div>
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
