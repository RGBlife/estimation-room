import { Play, type Match, type Random } from './match.ts';
import type { DuelPlay, DuelView, Mark } from '../../../types/games.ts';

// Dots and boxes (Games/DotsAndBoxes.cs) on four by four boxes: lines across
// first (five rows of four), then lines down (four rows of five).

export const SIZE = 4;
export const ACROSS = (SIZE + 1) * SIZE, EDGES = ACROSS * 2;

// The four lines around a box: top, bottom, left, right.
export function around(box: number): number[] {
  const row = Math.floor(box / SIZE), column = box % SIZE;
  return [row * SIZE + column, (row + 1) * SIZE + column, ACROSS + row * (SIZE + 1) + column, ACROSS + row * (SIZE + 1) + column + 1];
}
const BOXES = Array.from({ length: SIZE * SIZE }, (_, b) => b);
export const beside = (edge: number) => BOXES.filter(b => around(b).includes(edge));

export class DotsAndBoxes extends Play {
  edges: (Mark | null)[] = Array(EDGES).fill(null);
  boxes: (Mark | null)[] = Array(SIZE * SIZE).fill(null);
  last?: number;

  move(match: Match, uid: string, move: DuelPlay, now: number) {
    const edge = 'cell' in move ? move.cell : -1;
    if (!Number.isInteger(edge) || edge < 0 || edge >= EDGES) throw new Error('Choose a line between two dots');
    if (this.edges[edge]) throw new Error('That line is drawn');
    const mark = match.side(uid).mark!;
    this.edges[edge] = mark; this.last = edge;
    const closed = beside(edge).filter(b => around(b).every(e => this.edges[e]));
    for (const box of closed) this.boxes[box] = mark;
    if (this.edges.every(Boolean)) {
      const count = (mark: Mark | undefined) => this.boxes.filter(b => b === mark).length;
      return match.decide(count(match.challenger.mark), count(match.opponent.mark));
    }
    // Closing a box earns another line.
    if (closed.length > 0) match.turnStartedAt = now; else match.pass(uid, now);
    return false;
  }

  show(view: DuelView) {
    view.edges = [...this.edges];
    view.boxes = [...this.boxes];
    if (this.last !== undefined) view.last = this.last;
  }
}

const drawnAround = (edges: readonly (Mark | null)[], box: number) => around(box).filter(e => edges[e]).length;

// How many boxes the next player takes, closing every box they can, once `edge` is drawn.
function givesAway(edges: (Mark | null)[], edge: number): number {
  const drawn = [...edges];
  drawn[edge] = 'X';
  let taken = 0;
  for (let again = true; again;) {
    again = false;
    for (const box of BOXES) {
      if (drawnAround(drawn, box) !== 3) continue;
      const open = around(box).find(e => !drawn[e])!;
      drawn[open] = 'X'; taken++; again = true;
    }
  }
  return taken;
}

// The computer: closes any box it can, then draws a line that hands nothing
// over; when every line hands something over, the one that hands over least.
export function dotsMove(view: DuelView, _me: string, randomly: Random): number {
  const edges = view.edges!;
  const open = edges.map((_, i) => i).filter(i => !edges[i]);
  const closing = open.find(e => beside(e).some(b => drawnAround(edges, b) === 3));
  if (closing !== undefined) return closing;
  const safe = open.filter(e => beside(e).every(b => drawnAround(edges, b) < 2));
  if (safe.length > 0) return safe[randomly(safe.length)];
  let best = Infinity, choice = open[0];
  for (const edge of open) {
    const given = givesAway([...edges], edge);
    if (given < best) { best = given; choice = edge; }
  }
  return choice;
}
