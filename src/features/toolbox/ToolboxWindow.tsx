import { useEffect, useRef, type ReactNode } from 'react';
import './toolbox.css';

export type ToolboxGame = 'sorted' | 'rare' | 'noughts';

interface ToolboxWindowProps {
  coins: number;
  game: ToolboxGame;
  onSelectGame: (game: ToolboxGame) => void;
  // Games with something waiting for you: a challenge, or your move.
  waiting?: ToolboxGame[];
  closing: boolean;
  onClose: () => void;
  children: ReactNode;
}

// The games, solo and against someone at the table. Those still to come are
// listed so the shape of the Toolbox is clear.
const GAMES: { heading: string; games: { name: string; id?: ToolboxGame }[] }[] = [
  { heading: 'Solo', games: [{ name: 'Sorted', id: 'sorted' }, { name: 'Rare Find', id: 'rare' }] },
  { heading: 'Duel', games: [{ name: 'Noughts and crosses', id: 'noughts' }, { name: 'Battleship' }] },
];

// A window over the table, sized for a game board, with the table dimmed
// but visible behind it. A native modal keeps focus inside and Escape closes.
export default function ToolboxWindow({ coins, game, onSelectGame, waiting = [], closing, onClose, children }: ToolboxWindowProps) {
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
        <nav ref={nav} className="sp-toolbox-games" aria-label="Games">
          {GAMES.map(section => (
            <div key={section.heading}>
              <h3>{section.heading}</h3>
              <ul>
                {section.games.map(entry => (
                  <li key={entry.name}>
                    <button type="button" aria-current={entry.id === game ? 'true' : undefined} disabled={!entry.id}
                      onClick={() => entry.id && onSelectGame(entry.id)}>
                      <span>
                        {entry.name}
                        {entry.id && waiting.includes(entry.id) && <><i className="sp-toolbox-waiting" aria-hidden="true" /><span className="sr-only"> (waiting for you)</span></>}
                      </span>
                      {!entry.id && <small>Coming soon</small>}
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
