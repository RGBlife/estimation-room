import { Play, type Match, type Random } from './match.ts';
import type { DuelPlay, DuelSea, DuelView } from '../../../types/games.ts';

// Battleship (Games/Battleship.cs): a 6 by 6 sea and four ships each. A hit
// earns another shot. Each side sees only its own ships until it's over.

export const SEA = 6;
export const SHIPS = [3, 3, 2, 2];

// A fleet that fits the sea without ships overlapping (they may touch).
export function placeFleet(randomly: Random): number[][] {
  for (;;) {
    const taken = new Set<number>();
    const fleet: number[][] = [];
    for (const length of SHIPS) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const across = randomly(2) === 0;
        const row = randomly(across ? SEA : SEA - length + 1), column = randomly(across ? SEA - length + 1 : SEA);
        const cells = Array.from({ length }, (_, i) => across ? row * SEA + column + i : (row + i) * SEA + column);
        if (cells.some(c => taken.has(c))) continue;
        cells.forEach(c => taken.add(c)); fleet.push(cells); break;
      }
    }
    if (fleet.length === SHIPS.length) return fleet;
  }
}

export class Battleship extends Play {
  fleets: Record<string, number[][]> = {};
  shots: Record<string, number[]> = {};
  lastShot?: DuelView['lastShot'];
  // Fixed fleets, for the dev harness, so a visual test knows where to aim.
  private readonly given?: number[][][];
  constructor(given?: number[][][]) { super(); this.given = given; }
  get marks() { return false; }

  start(match: Match, randomly: Random) {
    match.sides.forEach((side, i) => { this.fleets[side.uid] = this.given?.[i] ?? placeFleet(randomly); this.shots[side.uid] = []; });
  }

  move(match: Match, uid: string, move: DuelPlay, now: number) {
    const cell = 'cell' in move ? move.cell : -1;
    if (!Number.isInteger(cell) || cell < 0 || cell >= SEA * SEA) throw new Error('Choose a square in their waters');
    const shots = this.shots[uid];
    if (shots.includes(cell)) throw new Error("You've already fired there");
    shots.push(cell);
    const fleet = this.fleets[match.other(uid).uid];
    const ship = fleet.find(s => s.includes(cell));
    this.lastShot = { by: uid, cell, hit: !!ship, sunk: !!ship && ship.every(c => shots.includes(c)) };
    if (fleet.every(s => s.every(c => shots.includes(c)))) { match.win(uid, 'sunk'); return true; }
    if (ship) match.turnStartedAt = now; else match.pass(uid, now);
    return false;
  }

  show(view: DuelView, match: Match, viewer: string) {
    const seas: Record<string, DuelSea> = {};
    for (const side of match.sides) {
      const shots = this.shots[match.other(side.uid).uid];
      const fleet = this.fleets[side.uid];
      seas[side.uid] = {
        shots: shots.map(cell => ({ cell, hit: fleet.some(s => s.includes(cell)) })),
        sunk: fleet.filter(s => s.every(c => shots.includes(c))),
        ...(side.uid === viewer || !match.live ? { fleet } : {}),
      };
    }
    view.seas = seas;
    if (this.lastShot) view.lastShot = { ...this.lastShot };
  }
}

// The computer: hunts on a checkerboard, then works along a ship once it
// has hit one, until it sinks. It sees what any player sees.
export function battleshipMove(view: DuelView, me: string, randomly: Random): number {
  const them = view.challenger.uid === me ? view.opponent.uid : view.challenger.uid;
  const sea = view.seas![them];
  const fired = new Set(sea.shots.map(s => s.cell));
  const sunk = new Set(sea.sunk.flat());
  const open = (cell: number) => cell >= 0 && cell < SEA * SEA && !fired.has(cell);
  const hits = sea.shots.filter(s => s.hit && !sunk.has(s.cell)).map(s => s.cell);
  const neighbours = (cell: number) => [cell - SEA, cell + SEA, cell % SEA > 0 ? cell - 1 : -1, cell % SEA < SEA - 1 ? cell + 1 : -1].filter(open);
  if (hits.length > 0) {
    // In line with two hits first: that's which way the ship lies.
    for (const a of hits) for (const b of hits) {
      if (a >= b) continue;
      const step = b - a === 1 && Math.floor(a / SEA) === Math.floor(b / SEA) ? 1 : b - a === SEA ? SEA : 0;
      if (!step) continue;
      const ends = [a - step, b + step].filter(c => open(c) && (step === SEA || Math.floor(c / SEA) === Math.floor(a / SEA)));
      if (ends.length) return ends[randomly(ends.length)];
    }
    const next = hits.flatMap(neighbours);
    if (next.length) return next[randomly(next.length)];
  }
  const checker = Array.from({ length: SEA * SEA }, (_, i) => i).filter(c => open(c) && (Math.floor(c / SEA) + c) % 2 === 0);
  const any = Array.from({ length: SEA * SEA }, (_, i) => i).filter(open);
  const pool = checker.length ? checker : any;
  return pool[randomly(pool.length)];
}
