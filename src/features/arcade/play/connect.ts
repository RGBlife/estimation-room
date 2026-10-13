import { Play, type Match, type Random } from './match.ts';
import type { DuelPlay, DuelView, Mark } from '../../../types/games.ts';

// Connect Four (Games/ConnectFour.cs): seven columns, six rows, four in a
// row wins. Squares go row by row from the top.

export const COLUMNS = 7, ROWS = 6;

// The run of four or more through `square`, if its mark made one.
export function runThrough(squares: readonly (Mark | null)[], square: number): number[] | null {
  const mark = squares[square];
  if (!mark) return null;
  const row = Math.floor(square / COLUMNS), column = square % COLUMNS;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const run = [square];
    for (const sign of [-1, 1]) {
      for (let r = row + dr * sign, c = column + dc * sign; r >= 0 && r < ROWS && c >= 0 && c < COLUMNS && squares[r * COLUMNS + c] === mark; r += dr * sign, c += dc * sign)
        run.push(r * COLUMNS + c);
    }
    if (run.length >= 4) return run.sort((a, b) => a - b);
  }
  return null;
}

// Where a counter dropped down `column` lands, or null when it's full.
export function landing(squares: readonly (Mark | null)[], column: number): number | null {
  for (let row = ROWS - 1; row >= 0; row--) if (!squares[row * COLUMNS + column]) return row * COLUMNS + column;
  return null;
}

export class ConnectFour extends Play {
  squares: (Mark | null)[] = Array(COLUMNS * ROWS).fill(null);
  last?: number;

  move(match: Match, uid: string, move: DuelPlay, now: number) {
    const column = 'cell' in move ? move.cell : -1;
    if (!Number.isInteger(column) || column < 0 || column >= COLUMNS) throw new Error('Choose a column');
    const square = landing(this.squares, column);
    if (square === null) throw new Error('That column is full');
    this.squares[square] = match.side(uid).mark!; this.last = square;
    const line = runThrough(this.squares, square);
    if (line) { match.win(uid, 'line', line); return true; }
    if (this.squares.every(Boolean)) { match.draw(); return true; }
    match.pass(uid, now);
    return false;
  }

  show(view: DuelView) {
    view.board = [...this.squares];
    if (this.last !== undefined) view.last = this.last;
  }
}

// How good a board is for `mark`: open runs of two and three, and the centre.
function weigh(squares: readonly (Mark | null)[], mark: Mark): number {
  const theirs = mark === 'X' ? 'O' : 'X';
  let score = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLUMNS; c++) {
    if (squares[r * COLUMNS + c] === mark && c === 3) score += 3;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [0, 1, 2, 3].map(i => [r + dr * i, c + dc * i]);
      if (cells.some(([rr, cc]) => rr < 0 || rr >= ROWS || cc < 0 || cc >= COLUMNS)) continue;
      const window = cells.map(([rr, cc]) => squares[rr * COLUMNS + cc]);
      const ours = window.filter(m => m === mark).length, them = window.filter(m => m === theirs).length;
      if (them === 0) score += ours === 3 ? 6 : ours === 2 ? 2 : 0;
      if (ours === 0) score -= them === 3 ? 8 : them === 2 ? 2 : 0;
    }
  }
  return score;
}

// Looking `depth` moves ahead, with alpha-beta pruning: the score of the best line for `mark`.
function search(squares: (Mark | null)[], mark: Mark, depth: number, alpha: number, beta: number): number {
  const theirs: Mark = mark === 'X' ? 'O' : 'X';
  if (depth === 0) return weigh(squares, mark);
  let best = -Infinity, any = false;
  for (const column of [3, 2, 4, 1, 5, 0, 6]) {
    const square = landing(squares, column);
    if (square === null) continue;
    any = true;
    squares[square] = mark;
    const score = runThrough(squares, square) ? 10_000 + depth : -search(squares, theirs, depth - 1, -beta, -alpha);
    squares[square] = null;
    best = Math.max(best, score); alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}

// The computer: four moves ahead, with a little chance in the opening so no
// two games go the same way.
export function connectMove(view: DuelView, me: string, randomly: Random): number {
  const mark = (view.challenger.uid === me ? view.challenger : view.opponent).mark!;
  const squares = [...view.board!];
  const theirs: Mark = mark === 'X' ? 'O' : 'X';
  let best = -Infinity, choice = 3;
  for (const column of [3, 2, 4, 1, 5, 0, 6]) {
    const square = landing(squares, column);
    if (square === null) continue;
    squares[square] = mark;
    const score = (runThrough(squares, square) ? 100_000 : -search(squares, theirs, 4, -Infinity, Infinity)) + randomly(3);
    squares[square] = null;
    if (score > best) { best = score; choice = column; }
  }
  return choice;
}
