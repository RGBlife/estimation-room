// Three, two, one over a game about to start: each number pops in as it
// comes up. Nothing once it's begun.
export default function Countdown({ ms, label = 'Get ready' }: { ms?: number; label?: string }) {
  if (!ms || ms <= 0) return null;
  const n = Math.ceil(ms / 1000);
  return (
    <div className="sp-countdown" role="status" aria-label={`${label}: ${n}`}>
      <small>{label}</small>
      <b key={n}>{n}</b>
    </div>
  );
}

// The game's own clock as a bar that empties, red for the last ten seconds.
export function ClockBar({ left, total }: { left?: number; total?: number }) {
  if (left === undefined || !total) return null;
  return (
    <div className="sp-duel-timer" aria-hidden="true" data-low={left < 10_000}>
      <span style={{ width: `${Math.max(0, Math.min(1, left / total)) * 100}%` }} />
    </div>
  );
}
