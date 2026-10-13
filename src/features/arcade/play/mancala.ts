import { Play, type Match, type Random } from './match.ts';
import type { DuelPlay, DuelView, Mark } from '../../../types/games.ts';

// Mancala, Kalah rules with four seeds a pit (Games/Mancala.cs). X's pits
// are 0 to 5 and store 6; O's pits 7 to 12 and store 13. Seeds go round
// anticlockwise: from X's pits towards X's store, then along O's side.

export const PITS = 6, SEEDS = 4;
export const STORE_X = PITS, STORE_O = PITS * 2 + 1;
export const store = (mark: Mark) => mark === 'X' ? STORE_X : STORE_O;
export const firstPit = (mark: Mark) => mark === 'X' ? 0 : STORE_X + 1;
export const opposite = (pit: number) => STORE_O - 1 - pit;

// Sows from `pit`; returns where the last seed landed.
export function sow(board: number[], pit: number, mark: Mark): number {
  let seeds = board[pit];
  board[pit] = 0;
  let at = pit;
  const theirs = store(mark === 'X' ? 'O' : 'X');
  while (seeds > 0) {
    at = (at + 1) % board.length;
    if (at === theirs) continue;
    board[at]++; seeds--;
  }
  const first = firstPit(mark);
  // The last seed in an empty pit of your own takes the seeds opposite with it.
  if (at >= first && at < first + PITS && board[at] === 1 && board[opposite(at)] > 0) {
    board[store(mark)] += board[opposite(at)] + 1;
    board[at] = 0; board[opposite(at)] = 0;
  }
  return at;
}

// Once a side's pits are all empty, each side banks what's left on its own.
export function finish(board: number[]): boolean {
  const empty = (first: number) => board.slice(first, first + PITS).every(s => s === 0);
  if (!empty(0) && !empty(STORE_X + 1)) return false;
  for (const [first, bank] of [[0, STORE_X], [STORE_X + 1, STORE_O]]) {
    for (let i = first; i < first + PITS; i++) { board[bank] += board[i]; board[i] = 0; }
  }
  return true;
}

export const newBoard = (): number[] => Array.from({ length: STORE_O + 1 }, (_, i) => i === STORE_X || i === STORE_O ? 0 : SEEDS);

export class Mancala extends Play {
  board = newBoard();
  last?: number;

  move(match: Match, uid: string, move: DuelPlay, now: number) {
    const mark = match.side(uid).mark!;
    const choice = 'cell' in move ? move.cell : -1;
    if (!Number.isInteger(choice) || choice < 0 || choice >= PITS) throw new Error('Choose one of your pits');
    const pit = firstPit(mark) + choice;
    if (this.board[pit] === 0) throw new Error('Choose a pit with seeds in it');
    this.last = pit;
    const landed = sow(this.board, pit, mark);
    if (finish(this.board)) return match.decide(this.board[store(match.challenger.mark!)], this.board[store(match.opponent.mark!)]);
    // The last seed in your own store earns another turn.
    if (landed === store(mark)) match.turnStartedAt = now; else match.pass(uid, now);
    return false;
  }

  show(view: DuelView) {
    view.pits = [...this.board];
    if (this.last !== undefined) view.last = this.last;
  }
}

// Looking ahead `depth` sowings: the best store lead `mark` can force. A
// sowing that ends in your store is followed by another of yours.
function search(board: number[], mark: Mark, depth: number): number {
  const theirs: Mark = mark === 'X' ? 'O' : 'X';
  if (depth === 0) return board[store(mark)] - board[store(theirs)];
  let best = -Infinity;
  for (let i = 0; i < PITS; i++) {
    const pit = firstPit(mark) + i;
    if (board[pit] === 0) continue;
    const next = [...board];
    const landed = sow(next, pit, mark);
    let score: number;
    if (finish(next)) score = (next[store(mark)] - next[store(theirs)]) * 100;
    else if (landed === store(mark)) score = search(next, mark, depth - 1);
    else score = -search(next, theirs, depth - 1);
    best = Math.max(best, score);
  }
  return best === -Infinity ? 0 : best;
}

// The computer: five sowings ahead, taking extra turns and captures.
export function mancalaMove(view: DuelView, me: string, randomly: Random): number {
  const mark = (view.challenger.uid === me ? view.challenger : view.opponent).mark!;
  let best = -Infinity, choice = 0;
  for (let i = 0; i < PITS; i++) {
    const pit = firstPit(mark) + i;
    if (view.pits![pit] === 0) continue;
    const next = [...view.pits!];
    const landed = sow(next, pit, mark);
    const theirs: Mark = mark === 'X' ? 'O' : 'X';
    const score = (finish(next) ? (next[store(mark)] - next[store(theirs)]) * 100 : landed === store(mark) ? search(next, mark, 4) : -search(next, theirs, 4)) + randomly(2) / 4;
    if (score > best) { best = score; choice = i; }
  }
  return choice;
}
