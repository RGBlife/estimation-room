import { useEffect, useRef, useState, type ReactNode } from 'react';
import './arcade.css';

export type ArcadeGame = 'sorted' | 'rare' | 'noughts' | 'battleship';

interface ArcadeWindowProps {
  coins: number;
  // The game open, or null for the Arcade's home.
  game: ArcadeGame | null;
  onHome: () => void;
  closing: boolean;
  onClose: () => void;
  children: ReactNode;
}

// The balance, counting up when coins land, with a "+N" chip rising into
// it, so a payout is seen arriving rather than just changing.
function Coins({ coins }: { coins: number }) {
  const [shown, setShown] = useState(coins);
  const [landed, setLanded] = useState<{ amount: number; key: number } | null>(null);
  const previous = useRef(coins);
  useEffect(() => {
    const from = previous.current;
    previous.current = coins;
    if (coins <= from || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(coins); return; }
    setLanded({ amount: coins - from, key: Date.now() });
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      setShown(Math.round(from + (coins - from) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [coins]);
  // Hidden until the first coin is earned.
  if (coins <= 0) return null;
  return (
    <span className="sp-arcade-coins" aria-label={`${coins} coins`}>
      <span aria-hidden="true">🪙 {shown}</span>
      {landed && <span key={landed.key} className="sp-arcade-coins-landed" aria-hidden="true" onAnimationEnd={() => setLanded(null)}>+{landed.amount}</span>}
    </span>
  );
}

// A window over the table, sized for a game board, with the table dimmed
// but visible behind it (on a phone, the whole screen). It opens on the
// Arcade's home; a game fills it, with the way back in the title bar. A
// native modal keeps focus inside and Escape closes.
export default function ArcadeWindow({ coins, game, onHome, closing, onClose, children }: ArcadeWindowProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => { node.close(); previous?.focus(); };
  }, []);
  return (
    <dialog ref={dialog} aria-label="Arcade" className="sp-arcade" data-closing={closing}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="sp-arcade-heading">
        {game
          ? <button type="button" className="sp-arcade-back" onClick={onHome}><span aria-hidden="true">‹</span> Arcade</button>
          : <h2><span aria-hidden="true">🕹</span> Arcade</h2>}
        <span className="sp-arcade-spacer" />
        <Coins coins={coins} />
        <button className="sp-planning-close" onClick={onClose} aria-label="Close the Arcade">×</button>
      </header>
      <div className="sp-arcade-body" data-game={game ?? 'home'}>{children}</div>
    </dialog>
  );
}
