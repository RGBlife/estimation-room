import { useState, type CSSProperties } from 'react';
import { PITS, STORE_O, STORE_X, firstPit, newBoard, store } from '../play/mancala.ts';
import type { Mark } from '../../../types/games.ts';
import type { BoardProps } from './types.ts';

// A wooden board: your six pits along the near side, left to right, your
// store on the right; theirs along the far side and their store on the
// left, so seeds always travel anticlockwise. When seeds are sown, the pits
// they fall in light up one after another, from the pit they left.
const SHOWN = 12;

// Scattered but steady places for up to SHOWN seeds in a pit.
const SPOTS = Array.from({ length: SHOWN }, (_, i) => {
  const angle = i * 2.4, radius = 9 + (i % 4) * 7;
  return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
});

// The pits a sowing of `seeds` from `pit` falls into, in order.
function sownFrom(pit: number, seeds: number, mark: Mark): number[] {
  const theirs = store(mark === 'X' ? 'O' : 'X');
  const path: number[] = [];
  for (let at = pit; path.length < seeds;) { at = (at + 1) % (STORE_O + 1); if (at !== theirs) path.push(at); }
  return path;
}

function Pit({ seeds, index, label, delay, onSow, store: isStore }: { seeds: number; index: number; label: string; delay?: number; onSow?: () => void; store?: boolean }) {
  const pebbles = Array.from({ length: Math.min(seeds, SHOWN) }, (_, i) => i);
  const body = (
    <>
      <svg viewBox="0 0 100 100" aria-hidden="true" className="sp-mancala-seeds">
        {pebbles.map(i => <circle key={i} cx={SPOTS[i][0]} cy={SPOTS[i][1]} r="7.5" data-tone={(i + index) % 4} />)}
      </svg>
      <b>{seeds}</b>
    </>
  );
  const style = delay !== undefined ? { '--sp-sow-delay': `${delay * 90}ms` } as CSSProperties : undefined;
  if (isStore) return <div className="sp-mancala-store" aria-label={label} role="img" data-sown={delay !== undefined || undefined} style={style}>{body}</div>;
  return (
    <button type="button" className="sp-mancala-pit" aria-label={label} disabled={!onSow || seeds === 0} onClick={onSow} data-sown={delay !== undefined || undefined} style={style}>
      {body}
    </button>
  );
}

export default function MancalaBoard({ duel, uid, playable, onMove }: BoardProps) {
  const pits = duel.pits ?? newBoard();
  const viewer = duel.challenger.uid === uid ? duel.challenger : duel.opponent.uid === uid ? duel.opponent : null;
  // You at the near side; watchers see X there.
  const near: Mark = viewer?.mark ?? 'X';
  const far: Mark = near === 'X' ? 'O' : 'X';
  const owner = (mark: Mark) => duel.challenger.mark === mark ? duel.challenger : duel.opponent;
  const whose = (mark: Mark) => owner(mark).uid === uid ? 'Your' : `${owner(mark).name}'s`;
  // The sowing just made, worked out from the board before it.
  const key = `${duel.last}:${pits.join(',')}`;
  const [sowing, setSowing] = useState<{ key: string; pits: number[]; path: number[] }>({ key, pits, path: [] });
  if (sowing.key !== key) {
    const last = duel.last;
    const mover: Mark | null = last === undefined ? null : last < STORE_X ? 'X' : 'O';
    setSowing({ key, pits, path: last !== undefined && mover && sowing.pits[last] > 0 ? sownFrom(last, sowing.pits[last], mover) : [] });
  }
  const delayOf = (pit: number) => { const i = sowing.path.indexOf(pit); return i < 0 ? undefined : i; };
  const row = (mark: Mark, reversed: boolean) => {
    const indexes = Array.from({ length: PITS }, (_, i) => firstPit(mark) + i);
    return (reversed ? indexes.reverse() : indexes).map(pit => (
      <Pit key={pit} seeds={pits[pit]} index={pit} delay={delayOf(pit)}
        label={`${whose(mark)} pit ${pit - firstPit(mark) + 1}, ${pits[pit]} seeds`}
        onSow={playable && mark === near ? () => void onMove({ cell: pit - firstPit(mark) }).catch(() => {}) : undefined} />
    ));
  };
  return (
    <div className="sp-mancala" role="group" aria-label="Mancala board">
      <Pit store seeds={pits[store(far)]} index={store(far)} delay={delayOf(store(far))} label={`${whose(far)} store, ${pits[store(far)]} seeds`} />
      <div className="sp-mancala-rows">
        <div className="sp-mancala-row" data-side="far">{row(far, true)}</div>
        <div className="sp-mancala-row" data-side="near">{row(near, false)}</div>
      </div>
      <Pit store seeds={pits[store(near)]} index={store(near)} delay={delayOf(store(near))} label={`${whose(near)} store, ${pits[store(near)]} seeds`} />
    </div>
  );
}
