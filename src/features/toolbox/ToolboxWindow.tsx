import { useEffect, useRef, type ReactNode } from 'react';
import './toolbox.css';

interface ToolboxWindowProps {
  coins: number;
  closing: boolean;
  onClose: () => void;
  children: ReactNode;
}

// The games, solo and against someone at the table. Only Sorted is built
// so far; the rest are listed so the shape of the Toolbox is clear.
const GAMES: { heading: string; games: { name: string; ready: boolean }[] }[] = [
  { heading: 'Solo', games: [{ name: 'Sorted', ready: true }, { name: 'Rarest answer', ready: false }] },
  { heading: 'Duel', games: [{ name: 'Noughts and crosses', ready: false }, { name: 'Battleship', ready: false }] },
];

// A window over the table, sized for a game board, with the table dimmed
// but visible behind it. A native modal keeps focus inside and Escape closes.
export default function ToolboxWindow({ coins, closing, onClose, children }: ToolboxWindowProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => { node.close(); previous?.focus(); };
  }, []);
  return (
    <dialog ref={dialog} aria-label="Toolbox" className="sp-toolbox" data-closing={closing}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="sp-toolbox-heading">
        <h2>Toolbox</h2>
        {/* Hidden until the first coin is earned. */}
        {coins > 0 && <span className="sp-toolbox-coins" aria-label={`${coins} coins`}>🪙 {coins}</span>}
        <button className="sp-planning-close" onClick={onClose} aria-label="Close toolbox">×</button>
      </header>
      <div className="sp-toolbox-body">
        <nav className="sp-toolbox-games" aria-label="Games">
          {GAMES.map(section => (
            <div key={section.heading}>
              <h3>{section.heading}</h3>
              <ul>
                {section.games.map(game => (
                  <li key={game.name}>
                    <button type="button" aria-current={game.ready ? 'true' : undefined} disabled={!game.ready}>
                      {game.name}{!game.ready && <small>Coming soon</small>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <section className="sp-toolbox-game">{children}</section>
      </div>
    </dialog>
  );
}
