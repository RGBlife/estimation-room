import { ACROSS, EDGES, SIZE } from '../play/dots.ts';
import type { BoardProps } from './types.ts';

// Squared paper with a grid of dots. Each gap between two dots is a button
// (drawn in SVG: HTML inside a scaled SVG lands in the wrong place in Safari);
// a drawn line is in its player's ink, and a closed box is stamped with
// its owner's mark.
const GAP = 60, PAD = 18;
const SPAN = GAP * SIZE + PAD * 2;

function ends(edge: number): [number, number, number, number] {
  if (edge < ACROSS) {
    const row = Math.floor(edge / SIZE), column = edge % SIZE;
    return [PAD + column * GAP, PAD + row * GAP, PAD + (column + 1) * GAP, PAD + row * GAP];
  }
  const e = edge - ACROSS, row = Math.floor(e / (SIZE + 1)), column = e % (SIZE + 1);
  return [PAD + column * GAP, PAD + row * GAP, PAD + column * GAP, PAD + (row + 1) * GAP];
}

export default function DotsBoard({ duel, playable, onMove }: BoardProps) {
  const edges = duel.edges ?? Array(EDGES).fill(null);
  const boxes = duel.boxes ?? Array(SIZE * SIZE).fill(null);
  const count = (mark: 'X' | 'O') => boxes.filter(b => b === mark).length;
  const draw = (edge: number) => { if (playable) void onMove({ cell: edge }).catch(() => {}); };
  return (
    <div className="sp-dots">
      <svg viewBox={`0 0 ${SPAN} ${SPAN}`} role="group" aria-label={`Dots and boxes: X has ${count('X')} boxes, O has ${count('O')}`}>
        {boxes.map((mark, box) => mark && (
          <g key={`b${box}`} className="sp-dots-box" data-mark={mark}>
            <rect x={PAD + (box % SIZE) * GAP + 3} y={PAD + Math.floor(box / SIZE) * GAP + 3} width={GAP - 6} height={GAP - 6} rx="5" />
            <text x={PAD + (box % SIZE) * GAP + GAP / 2} y={PAD + Math.floor(box / SIZE) * GAP + GAP / 2 + 9}>{mark}</text>
          </g>
        ))}
        {edges.map((mark, edge) => {
          const [x1, y1, x2, y2] = ends(edge);
          const name = `${edge < ACROSS ? 'Line across' : 'Line down'} ${edge + 1}${mark ? `, drawn by ${mark}` : ''}`;
          return (
            <g key={edge} className="sp-dots-edge" data-mark={mark ?? undefined} data-last={duel.last === edge || undefined}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} />
              {!mark && (
                <rect className="sp-dots-gap" x={Math.min(x1, x2) - 13} y={Math.min(y1, y2) - 13} width={Math.abs(x2 - x1) + 26} height={Math.abs(y2 - y1) + 26} rx="10"
                  role="button" aria-label={name} aria-disabled={!playable} tabIndex={playable ? 0 : -1}
                  onClick={() => draw(edge)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); draw(edge); } }} />
              )}
            </g>
          );
        })}
        {Array.from({ length: (SIZE + 1) ** 2 }, (_, i) => (
          <circle key={`d${i}`} className="sp-dots-dot" cx={PAD + (i % (SIZE + 1)) * GAP} cy={PAD + Math.floor(i / (SIZE + 1)) * GAP} r="5" />
        ))}
      </svg>
    </div>
  );
}
