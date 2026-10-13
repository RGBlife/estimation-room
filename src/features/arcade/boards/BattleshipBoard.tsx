import { useEffect, useRef, useState } from 'react';
import { SEA } from '../play/battleship.ts';
import type { DuelSea, DuelSide } from '../../../types/games.ts';
import type { BoardProps } from './types.ts';

const ROWS = 'ABCDEF';
// How long a shot's result stays in view before the boards trade places.
const SETTLE_MS = 700;

// Which piece of a hull each ship square is, so a ship draws as one
// rounded shape across its squares rather than a row of blocks.
function hulls(ships: number[][]): Map<number, string> {
  const parts = new Map<number, string>();
  for (const ship of ships) {
    const cells = [...ship].sort((a, b) => a - b);
    const across = cells.length > 1 && cells[1] - cells[0] === 1;
    cells.forEach((cell, i) => parts.set(cell, `${across ? 'h' : 'v'}-${i === 0 ? 'start' : i === cells.length - 1 ? 'end' : 'mid'}`));
  }
  return parts;
}

// One side's waters. Firing at them is possible only on the target grid on
// your turn; your own grid shows your hulls and where theirs landed. A
// sunk ship shows its hull in either. A hit on your own fleet shakes it.
function Sea({ label, sea, playable, onFire, last, focused, struck }: { label: string; sea: DuelSea; playable: boolean; onFire?: (cell: number) => void; last?: number; focused?: boolean; struck?: boolean }) {
  const grid = useRef<HTMLDivElement>(null);
  // Only shots landing while you watch, not the one already there on opening.
  const seen = useRef(last);
  useEffect(() => {
    if (seen.current === last) return;
    seen.current = last;
    if (!struck || last === undefined || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    grid.current?.animate?.([
      { transform: 'none', boxShadow: '0 3px 0 var(--sp-border-strong), inset 0 0 0 1px #ffffff14' },
      { transform: 'translateX(-6px) rotate(-1deg)', boxShadow: '0 3px 0 var(--sp-border-strong), inset 0 0 0 3px var(--sp-sea-hit)', offset: 0.2 },
      { transform: 'translateX(5px) rotate(.8deg)', offset: 0.45 },
      { transform: 'translateX(-3px)', offset: 0.7 },
      { transform: 'none', boxShadow: '0 3px 0 var(--sp-border-strong), inset 0 0 0 1px #ffffff14' },
    ], { duration: 420, easing: 'ease-out' });
  }, [struck, last]);
  const shots = new Map(sea.shots.map(s => [s.cell, s.hit]));
  const ships = hulls(sea.fleet ?? []);
  const wrecks = hulls(sea.sunk);
  const sunk = new Set(sea.sunk.flat());
  return (
    <div className="sp-sea" data-focused={focused}>
      <h4>{label}</h4>
      <div ref={grid} className="sp-sea-grid" role="group" aria-label={label} data-target={playable || undefined}>
        {Array.from({ length: SEA * SEA }, (_, cell) => {
          const shot = shots.get(cell);
          const state = sunk.has(cell) ? 'sunk' : shot === true ? 'hit' : shot === false ? 'miss' : ships.has(cell) ? 'ship' : 'water';
          const hull = wrecks.get(cell) ?? ships.get(cell);
          const name = `${ROWS[Math.floor(cell / SEA)]}${(cell % SEA) + 1}`;
          return (
            <button key={cell} type="button" className="sp-sea-cell" data-state={state} data-last={cell === last || undefined}
              aria-label={`${name}${state === 'water' ? '' : `, ${state}`}`}
              disabled={!playable || shot !== undefined} onClick={() => onFire?.(cell)}>
              {hull && <i className="sp-sea-hull" data-part={hull} data-sunk={sunk.has(cell) || undefined} aria-hidden="true" />}
              {shot !== undefined && <i className="sp-sea-shot" data-hit={shot || undefined} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Whichever sea is in play has the big place: theirs on your turn, yours
// on theirs. The change waits a beat after each turn passes, so the shot
// that passed it is seen landing first.
function useFocus(yours: boolean) {
  const [focus, setFocus] = useState(yours);
  useEffect(() => {
    if (focus === yours) return;
    const timer = setTimeout(() => setFocus(yours), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [focus, yours]);
  return focus;
}

export default function BattleshipBoard({ duel, uid, playable, onMove }: BoardProps) {
  const fire = (cell: number) => void onMove({ cell }).catch(() => {});
  const theirTurn = duel.status === 'playing' && !!duel.turn && duel.turn !== uid;
  const fleetInFocus = useFocus(theirTurn);
  if (!duel.seas) return <p className="sp-sorted-hint">The fleets put to sea once the challenge is accepted.</p>;
  const me = duel.challenger.uid === uid ? duel.challenger : duel.opponent.uid === uid ? duel.opponent : null;
  const them = me && (me === duel.challenger ? duel.opponent : duel.challenger);
  const empty: DuelSea = { shots: [], sunk: [] };
  const lastIn = (owner: DuelSide) => duel.lastShot && duel.lastShot.by !== owner.uid ? duel.lastShot.cell : undefined;
  if (me && them) {
    return (
      <div className="sp-seas">
        <Sea label="Their waters" sea={duel.seas[them.uid] ?? empty} playable={playable} onFire={fire} last={lastIn(them)} focused={!fleetInFocus || duel.status !== 'playing'} />
        <Sea label="Your fleet" sea={duel.seas[me.uid] ?? empty} playable={false} last={lastIn(me)} focused={fleetInFocus} struck={duel.lastShot?.by === them.uid && duel.lastShot.hit} />
      </div>
    );
  }
  return (
    <div className="sp-seas">
      {[duel.challenger, duel.opponent].map(side => (
        <Sea key={side.uid} label={`${side.name}'s fleet`} sea={duel.seas![side.uid] ?? empty} playable={false} last={lastIn(side)} focused={duel.status !== 'playing' || side.uid !== duel.turn} />
      ))}
    </div>
  );
}
