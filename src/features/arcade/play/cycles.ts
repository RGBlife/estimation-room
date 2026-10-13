import { TimedPlay } from './timed.ts';
import type { Match } from './match.ts';
import type { DuelSteer, DuelView } from '../../../types/games.ts';

// Light cycles, first to two rounds (Games/LightCycles.cs). Both ride at
// once, a square at a time, leaving a wall; hit any wall and the round is
// lost. Only the turns are sent: every screen draws the same walls from them.

export const SIZE = 24, FIRST_TO = 2;
export const STEP_MS = 100, RESULT_MS = 1800, ROUND_READY_MS = 1500;
// Up, right, down, left.
export const MOVES: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
// Where each side starts and which way it faces: the challenger on the left.
export const STARTS: readonly [number, number, number][] = [[4, SIZE - 8, 1], [SIZE - 5, 7, 3]];

// Each side's trail this round, square by square from its start, as drawn
// from its turns: where it was after every step up to `steps`.
export function trail(start: readonly [number, number, number], turns: readonly (readonly [number, number])[], steps: number): [number, number][] {
  let [x, y, dir] = start;
  const squares: [number, number][] = [[x, y]];
  let next = 0;
  for (let step = 1; step <= steps; step++) {
    while (next < turns.length && turns[next][0] === step) dir = turns[next++][1];
    x += MOVES[dir][0]; y += MOVES[dir][1];
    squares.push([x, y]);
  }
  return squares;
}

export class LightCycles extends TimedPlay {
  readonly limitMs = 180_000;
  round = 1;
  phase: 'ready' | 'riding' | 'result' = 'ready';
  steps = 0;
  won: Record<string, number> = {};
  turned: Record<string, [number, number][]> = {};
  crashed: string[] = [];
  private heads: Record<string, [number, number, number]> = {};
  private wanted: Record<string, number[]> = {};
  private walls = new Uint8Array(SIZE * SIZE);
  private nextAt = 0;
  private moved = false;

  protected begin(match: Match) {
    for (const side of match.sides) this.won[side.uid] = 0;
    this.reset(match, this.startsAt);
  }
  resume(match: Match, now: number) { super.resume(match, now); this.reset(match, this.startsAt); }

  private reset(match: Match, at: number) {
    this.walls.fill(0); this.crashed = []; this.steps = 0; this.phase = 'ready'; this.nextAt = at; this.moved = true;
    match.sides.forEach((side, i) => {
      const [x, y, dir] = STARTS[i];
      this.heads[side.uid] = [x, y, dir]; this.walls[y * SIZE + x] = 1;
      this.turned[side.uid] = []; this.wanted[side.uid] = [];
    });
  }

  // A turn, taken at the next step; two can wait, for a quick double turn.
  // Turning back on yourself is ignored.
  steer(_match: Match, uid: string, input: DuelSteer) {
    if (!('dir' in input) || !Number.isInteger(input.dir) || input.dir < 0 || input.dir > 3) throw new Error('Choose a direction');
    const queue = this.wanted[uid];
    const facing = queue.length ? queue[queue.length - 1] : this.heads[uid][2];
    if (queue.length >= 2 || input.dir === facing || input.dir === (facing + 2) % 4) return;
    queue.push(input.dir);
  }

  tick(match: Match, now: number) {
    if (super.tick(match, now)) return true;
    if (this.phase === 'ready' && now >= this.nextAt) { this.phase = 'riding'; this.moved = true; }
    if (this.phase === 'result' && now >= this.nextAt) { this.round++; this.reset(match, now + ROUND_READY_MS); return true; }
    while (this.phase === 'riding' && now >= this.nextAt) {
      this.nextAt += STEP_MS;
      if (this.step(match, now)) return true;
    }
    return false;
  }

  // Every cycle one square on; returns true when the round is over.
  private step(match: Match, now: number) {
    this.steps++; this.moved = true;
    const next: Record<string, [number, number, number]> = {};
    for (const side of match.sides) {
      let [x, y, dir] = this.heads[side.uid];
      const turn = this.wanted[side.uid].shift();
      if (turn !== undefined) { dir = turn; this.turned[side.uid].push([this.steps, dir]); }
      x += MOVES[dir][0]; y += MOVES[dir][1];
      next[side.uid] = [x, y, dir];
    }
    for (const side of match.sides) {
      const [x, y] = next[side.uid];
      const [ox, oy] = next[match.other(side.uid).uid];
      if (x < 0 || x >= SIZE || y < 0 || y >= SIZE || this.walls[y * SIZE + x] || (ox === x && oy === y)) this.crashed.push(side.uid);
    }
    for (const side of match.sides) {
      this.heads[side.uid] = next[side.uid];
      if (!this.crashed.includes(side.uid)) this.walls[next[side.uid][1] * SIZE + next[side.uid][0]] = 1;
    }
    if (this.crashed.length === 0) return false;
    this.phase = 'result'; this.nextAt = now + RESULT_MS;
    if (this.crashed.length === 1) {
      const winner = match.other(this.crashed[0]).uid;
      if (++this.won[winner] >= FIRST_TO) { match.win(winner); return true; }
    }
    return true;
  }
  protected scores(match: Match): [number, number] { return [this.won[match.challenger.uid], this.won[match.opponent.uid]]; }

  private ride(match: Match): Partial<DuelView> {
    return {
      round: this.round, phase: this.phase, steps: this.steps,
      turns: match.bySide(s => this.turned[s.uid].map(([step, dir]) => [step, dir] as [number, number])),
      crashed: [...this.crashed],
    };
  }
  frame(match: Match) {
    if (!this.moved) return null;
    this.moved = false;
    return this.ride(match);
  }

  show(view: DuelView, match: Match, _viewer: string, now: number) {
    this.clocks(view, match, now);
    Object.assign(view, this.ride(match));
    view.won = match.bySide(s => this.won[s.uid]);
    if (this.phase === 'ready' && match.live) view.rideInMs = Math.max(0, this.nextAt - now);
  }
}
