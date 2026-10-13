import { Mark } from './Marks.tsx';
import { GRID_LINES, strike } from './strokes.ts';
import type { BoardProps } from './types.ts';

// Nine whiteboards in one. The board you must play in glows; a board that's
// won gets its owner's mark drawn big across it, and three of those in a
// row are struck through.
export default function UltimateBoard({ duel, playable, onMove }: BoardProps) {
  const squares = duel.board ?? Array(81).fill(null);
  const boards = duel.boards ?? Array(9).fill(null);
  const forced = duel.forced;
  return (
    <div className="sp-ultimate" data-anywhere={duel.status === 'playing' && forced === undefined || undefined}>
      <svg className="sp-ultimate-lines" viewBox="0 0 300 300" aria-hidden="true"><path d={GRID_LINES} /></svg>
      <div className="sp-ultimate-grid" role="group" aria-label="Boards">
        {boards.map((result, b) => {
          const open = !result && (forced === undefined || forced === b);
          const label = `Board ${b + 1}${result === 'D' ? ', drawn' : result ? `, won by ${result}` : open && duel.status === 'playing' ? ', open' : ''}`;
          return (
            <div key={b} className="sp-ultimate-board" role="group" aria-label={label}
              data-result={result ?? undefined} data-open={duel.status === 'playing' && open || undefined} data-line={duel.line?.includes(b) || undefined}>
              <svg className="sp-ultimate-small-lines" viewBox="0 0 300 300" aria-hidden="true"><path d={GRID_LINES} /></svg>
              <div className="sp-ultimate-squares">
                {squares.slice(b * 9, b * 9 + 9).map((mark, s) => {
                  const square = b * 9 + s;
                  return (
                    <button key={s} type="button" className="sp-ultimate-square" data-last={duel.last === square || undefined}
                      aria-label={`Square ${s + 1}${mark ? `, ${mark}` : ''}`}
                      disabled={!playable || !open || !!mark} onClick={() => void onMove({ cell: square }).catch(() => {})}>
                      {mark && <Mark mark={mark} />}
                    </button>
                  );
                })}
              </div>
              {(result === 'X' || result === 'O') && <span className="sp-ultimate-won"><Mark mark={result} /></span>}
            </div>
          );
        })}
      </div>
      {duel.line && <svg className="sp-noughts-win" viewBox="0 0 300 300" aria-hidden="true"><path pathLength={1} d={strike(duel.line)} /></svg>}
    </div>
  );
}
