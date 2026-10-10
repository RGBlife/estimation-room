import { useEffect, useRef, type ReactNode } from 'react';
import './arcade.css';

export type ArcadeGame = 'sorted' | 'rare' | 'noughts' | 'battleship';

interface ArcadeWindowProps {
  coins: number;
  game: ArcadeGame;
  onSelectGame: (game: ArcadeGame) => void;
  // Games with something waiting for you: a challenge, or your move.
  waiting?: ArcadeGame[];
  closing: boolean;
  onClose: () => void;
  children: ReactNode;
}

// The games, solo and against someone at the table.
const GAMES: { heading: string; games: { name: string; id: ArcadeGame }[] }[] = [
  { heading: 'Solo', games: [{ name: 'Sorted', id: 'sorted' }, { name: 'Rare Find', id: 'rare' }] },
  { heading: 'Duel', games: [{ name: 'Noughts and crosses', id: 'noughts' }, { name: 'Battleship', id: 'battleship' }] },
];

// A window over the table, sized for a game board, with the table dimmed
// but visible behind it. A native modal keeps focus inside and Escape closes.
export default function ArcadeWindow({ coins, game, onSelectGame, waiting = [], closing, onClose, children }: ArcadeWindowProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => { node.close(); previous?.focus(); };
  }, []);
  // On a phone the games are a scrolling row: keep the open one in view.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => { nav.current?.querySelector('[aria-current]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [game]);
  return (
    <dialog ref={dialog} aria-label="Arcade" className="sp-arcade" data-closing={closing}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="sp-arcade-heading">
        <h2>Arcade</h2>
        {/* Hidden until the first coin is earned. */}
        {coins > 0 && <span className="sp-arcade-coins" aria-label={`${coins} coins`}>🪙 {coins}</span>}
        <button className="sp-planning-close" onClick={onClose} aria-label="Close the Arcade">×</button>
      </header>
      <div className="sp-arcade-body">
        <nav ref={nav} className="sp-arcade-games" aria-label="Games">
          {GAMES.map(section => (
            <div key={section.heading}>
              <h3>{section.heading}</h3>
              <ul>
                {section.games.map(entry => (
                  <li key={entry.name}>
                    <button type="button" aria-current={entry.id === game ? 'true' : undefined} onClick={() => onSelectGame(entry.id)}>
                      <span>
                        {entry.name}
                        {waiting.includes(entry.id) && <><i className="sp-arcade-waiting" aria-hidden="true" /><span className="sr-only"> (waiting for you)</span></>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <section className="sp-arcade-game">{children}</section>
      </div>
    </dialog>
  );
}
