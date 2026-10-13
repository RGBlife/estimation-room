import { useState, type CSSProperties } from 'react';
import { COLUMNS, ROWS, landing } from '../play/connect.ts';
import type { BoardProps } from './types.ts';

// An upright frame, built like the real thing: the counters sit behind a
// blue face with holes cut in it, so a counter dropped in falls down its
// column, seen through each hole it passes, and lands with a bounce. A
// counter waits over the column you point at, the columns are the
// buttons (a counter always lands as low as it can), and the winning four glow.
export default function ConnectBoard({ duel, uid, playable, onMove }: BoardProps) {
  const squares = duel.board ?? Array(COLUMNS * ROWS).fill(null);
  const [hover, setHover] = useState<number | null>(null);
  const mine = (duel.challenger.uid === uid ? duel.challenger : duel.opponent.uid === uid ? duel.opponent : null)?.mark;
  return (
    <div className="sp-connect" style={{ '--sp-columns': COLUMNS, '--sp-rows': ROWS } as CSSProperties}>
      <div className="sp-connect-hover" aria-hidden="true">
        {Array.from({ length: COLUMNS }, (_, c) => (
          <span key={c}>{playable && hover === c && mine && landing(squares, c) !== null && <i className="sp-connect-counter" data-mark={mine} data-ghost />}</span>
        ))}
      </div>
      <div className="sp-connect-frame">
        <div className="sp-connect-cells">
          {squares.map((mark, square) => mark && (
            <span key={square} className="sp-connect-slot" data-line={duel.line?.includes(square) || undefined}
              style={{ '--sp-row': Math.floor(square / COLUMNS), '--sp-column': square % COLUMNS } as CSSProperties}>
              <i className="sp-connect-counter" data-mark={mark} data-last={duel.last === square || undefined} />
            </span>
          ))}
          <span className="sp-connect-face" aria-hidden="true" />
          <div className="sp-connect-columns" role="group" aria-label="Columns">
            {Array.from({ length: COLUMNS }, (_, c) => {
              const full = landing(squares, c) === null;
              const counters = squares.filter((m, s) => m && s % COLUMNS === c).length;
              return (
                <button key={c} type="button" className="sp-connect-column" aria-label={`Column ${c + 1}${full ? ', full' : counters ? `, ${counters} in` : ''}`}
                  disabled={!playable || full} onPointerEnter={() => setHover(c)} onPointerLeave={() => setHover(h => h === c ? null : h)}
                  onFocus={() => setHover(c)} onBlur={() => setHover(null)} onClick={() => void onMove({ cell: c }).catch(() => {})} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
