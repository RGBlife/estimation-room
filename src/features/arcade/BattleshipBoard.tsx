import type { DuelSea, DuelSide, DuelView } from '../../types/games.ts';

// Matches Duels.Sea in the room service.
const SEA = 6;
const ROWS = 'ABCDEF';

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
// sunk ship shows its hull in either.
function Sea({ label, sea, playable, onFire, last }: { label: string; sea: DuelSea; playable: boolean; onFire?: (cell: number) => void; last?: number }) {
  const shots = new Map(sea.shots.map(s => [s.cell, s.hit]));
  const ships = hulls(sea.fleet ?? []);
  const wrecks = hulls(sea.sunk);
  const sunk = new Set(sea.sunk.flat());
  return (
    <div className="sp-sea">
      <h4>{label}</h4>
      <div className="sp-sea-grid" role="group" aria-label={label} data-target={playable || undefined}>
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

export default function BattleshipBoard({ duel, uid, playable, onMove }: { duel: DuelView; uid: string | null; playable: boolean; onMove: (cell: number) => void }) {
  if (!duel.seas) return <p className="sp-sorted-hint">The fleets put to sea once the challenge is accepted.</p>;
  const me = duel.challenger.uid === uid ? duel.challenger : duel.opponent.uid === uid ? duel.opponent : null;
  const them = me && (me === duel.challenger ? duel.opponent : duel.challenger);
  const empty: DuelSea = { shots: [], sunk: [] };
  const lastIn = (owner: DuelSide) => duel.lastShot && duel.lastShot.by !== owner.uid ? duel.lastShot.cell : undefined;
  if (me && them) {
    return (
      <div className="sp-seas">
        <Sea label="Their waters" sea={duel.seas[them.uid] ?? empty} playable={playable} onFire={onMove} last={lastIn(them)} />
        <Sea label="Your fleet" sea={duel.seas[me.uid] ?? empty} playable={false} last={lastIn(me)} />
      </div>
    );
  }
  return (
    <div className="sp-seas">
      {[duel.challenger, duel.opponent].map(side => (
        <Sea key={side.uid} label={`${side.name}'s fleet`} sea={duel.seas![side.uid] ?? empty} playable={false} last={lastIn(side)} />
      ))}
    </div>
  );
}
