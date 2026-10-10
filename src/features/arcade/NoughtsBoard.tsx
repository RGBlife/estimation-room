import type { DuelView } from '../../types/games.ts';

// A mark drawn in marker: each stroke draws itself in (pathLength 1, so
// the dash animation is the same whatever the stroke's real length).
function Mark({ mark }: { mark: 'X' | 'O' }) {
  return mark === 'X' ? (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="sp-noughts-mark" data-mark="X">
      <path pathLength={1} d="M24 22c18 20 34 38 53 57" />
      <path pathLength={1} d="M76 21C58 41 42 58 23 78" className="sp-noughts-second" />
    </svg>
  ) : (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="sp-noughts-mark" data-mark="O">
      <path pathLength={1} d="M52 20c-19-2-33 13-32 31 1 17 14 30 31 29 18-1 30-15 29-32-1-16-13-28-30-28-3 0-6 1-8 2" />
    </svg>
  );
}

// A whiteboard: four hand-drawn lines, the marks drawn in marker, and the
// winning three struck through.
export default function NoughtsBoard({ duel, playable, onMove }: { duel: DuelView; playable: boolean; onMove: (cell: number) => void }) {
  const centre = (cell: number) => [(cell % 3) * 100 + 50, Math.floor(cell / 3) * 100 + 50];
  const line = duel.line && [centre(duel.line[0]), centre(duel.line[2])];
  return (
    <div className="sp-noughts">
      <svg className="sp-noughts-lines" viewBox="0 0 300 300" aria-hidden="true">
        <path d="M101 14c-2 90 2 182-1 272M199 12c2 92-2 184 1 275M14 100c92-3 182 2 272-1M12 199c93 3 184-2 275 2" />
      </svg>
      <div className="sp-noughts-grid" role="group" aria-label="Board">
        {(duel.board ?? []).map((mark, cell) => (
          <button key={cell} type="button" className="sp-noughts-cell" data-line={duel.line?.includes(cell) || undefined}
            aria-label={`Square ${cell + 1}${mark ? `, ${mark}` : ''}`}
            disabled={!playable || mark !== null} onClick={() => onMove(cell)}>
            {mark && <Mark mark={mark} />}
          </button>
        ))}
      </div>
      {line && (
        <svg className="sp-noughts-win" viewBox="0 0 300 300" aria-hidden="true">
          <path pathLength={1} d={`M${line[0][0] - (line[1][0] - line[0][0]) * 0.18} ${line[0][1] - (line[1][1] - line[0][1]) * 0.18}L${line[1][0] + (line[1][0] - line[0][0]) * 0.18} ${line[1][1] + (line[1][1] - line[0][1]) * 0.18}`} />
        </svg>
      )}
    </div>
  );
}
