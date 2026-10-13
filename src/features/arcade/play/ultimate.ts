import { LINES, Play, type Match, type Random } from './match.ts';
import type { DuelPlay, DuelView, Mark } from '../../../types/games.ts';

// Ultimate noughts and crosses (Games/UltimateNoughts.cs): nine small boards
// in a big one. The square you play sends the other player to the matching
// small board; a board that's won or full sends them anywhere.

export const lineOf = (cells: readonly (string | null)[]) =>
  LINES.find(l => (cells[l[0]] === 'X' || cells[l[0]] === 'O') && cells[l[0]] === cells[l[1]] && cells[l[1]] === cells[l[2]]);

export class UltimateNoughts extends Play {
  squares: (Mark | null)[] = Array(81).fill(null);
  boards: (Mark | 'D' | null)[] = Array(9).fill(null);
  forced: number | null = null;
  last?: number;

  move(match: Match, uid: string, move: DuelPlay, now: number) {
    const square = 'cell' in move ? move.cell : -1;
    const board = Math.floor(square / 9);
    if (!Number.isInteger(square) || square < 0 || square > 80 || this.squares[square] || this.boards[board]) throw new Error('Choose an empty square');
    if (this.forced !== null && this.forced !== board) throw new Error('Play in the highlighted board');
    const mark = match.side(uid).mark!;
    this.squares[square] = mark; this.last = square;
    const small = this.squares.slice(board * 9, board * 9 + 9);
    if (lineOf(small)) this.boards[board] = mark;
    else if (small.every(Boolean)) this.boards[board] = 'D';
    const line = lineOf(this.boards);
    if (line) { match.win(uid, 'line', line); return true; }
    if (this.boards.every(Boolean)) { match.draw(); return true; }
    const next = square % 9;
    this.forced = this.boards[next] ? null : next;
    match.pass(uid, now);
    return false;
  }

  show(view: DuelView, match: Match) {
    view.board = [...this.squares];
    view.boards = [...this.boards];
    if (match.live && this.forced !== null) view.forced = this.forced;
    if (this.last !== undefined) view.last = this.last;
  }
}

// The squares open to the next move.
export function openSquares(view: DuelView): number[] {
  const board = view.board!, boards = view.boards!;
  return board.map((_, i) => i).filter(i => !board[i] && !boards[Math.floor(i / 9)] && (view.forced === undefined || view.forced === Math.floor(i / 9)));
}

// Whether `mark` could take small board `b` with one more move.
function threatens(board: readonly (string | null)[], b: number, mark: Mark) {
  const small = board.slice(b * 9, b * 9 + 9);
  return LINES.some(l => l.filter(i => small[i] === mark).length === 2 && l.some(i => !small[i]));
}

// The computer: takes a win, blocks one, and avoids sending you somewhere
// you can win or choose freely; otherwise it prefers centres and corners.
export function ultimateMove(view: DuelView, me: string, randomly: Random): number {
  const mine = (view.challenger.uid === me ? view.challenger : view.opponent).mark!;
  const theirs: Mark = mine === 'X' ? 'O' : 'X';
  let best = -Infinity, choice = -1;
  for (const square of openSquares(view)) {
    const b = Math.floor(square / 9), s = square % 9;
    const board = [...view.board!];
    const boards = [...view.boards!];
    board[square] = mine;
    let score = randomly(30) / 10;
    if (lineOf(board.slice(b * 9, b * 9 + 9))) {
      boards[b] = mine;
      score += lineOf(boards) ? 1000 : 25;
    }
    // Blocking: they could have taken this board here.
    const blocked = [...view.board!]; blocked[square] = theirs;
    if (lineOf(blocked.slice(b * 9, b * 9 + 9))) score += 18;
    // Where it sends them.
    const sent = boards[s] || board.slice(s * 9, s * 9 + 9).every(Boolean) ? null : s;
    if (sent === null) score -= 10;
    else if (threatens(board, sent, theirs)) score -= 16;
    if (s === 4) score += 3; else if (s % 2 === 0) score += 1.5;
    if (score > best) { best = score; choice = square; }
  }
  return choice;
}
