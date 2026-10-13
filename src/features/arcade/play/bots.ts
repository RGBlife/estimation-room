import { battleshipMove } from './battleship.ts';
import { connectMove } from './connect.ts';
import { dotsMove } from './dots.ts';
import { mancalaMove } from './mancala.ts';
import { ultimateMove } from './ultimate.ts';
import { solve } from './words.ts';
import { work } from './maths.ts';
import { ballAt, LENGTH, PADDLE_AT, WIDTH } from './pong.ts';
import { MOVES, SIZE, STARTS, trail } from './cycles.ts';
import type { Random } from './match.ts';
import type { DuelGame, DuelPlay, DuelSteer, DuelView } from '../../../types/games.ts';

// The computer, playing from what it can see, as any player would: its own
// view of the duel. Called every tick; it answers with a move, some
// steering, or nothing yet. It's beatable on purpose: it thinks for a
// moment before each move, types at about 45 words a minute, and its
// paddle has a top speed.
export type Act = { move: DuelPlay } | { steer: DuelSteer } | null;
export type Bot = (view: DuelView, me: string, now: number) => Act;

const between = (randomly: Random, low: number, high: number) => low + randomly(high - low + 1);

// Turn games: a pause to think once it's the computer's turn, then a move.
// The first move of a turn can wait longer than the rest (another shot
// after a hit), so the board has turned to show it.
function turns(randomly: Random, choose: (view: DuelView, me: string) => number, think: [number, number] = [550, 1200], first = think): Bot {
  let since: number | null = null, delay = 0, seen = '', mine = false;
  return (view, me, now) => {
    const key = JSON.stringify([view.last, view.lastShot, view.edges?.filter(Boolean).length]);
    if (view.status !== 'playing' || view.paused || view.turn !== me) { since = null; mine = false; return null; }
    if (since === null || key !== seen) { since = now; seen = key; delay = between(randomly, ...(mine ? think : first)); mine = true; }
    if (now - since < delay) return null;
    since = null;
    return { move: { cell: choose(view, me) } };
  };
}

// Reaction: a tap a quarter of a second or so after green; never early.
function reaction(randomly: Random): Bot {
  let tapped = 0, green: number | null = null, wait = 0;
  return (view, _me, now) => {
    if (view.phase !== 'go') { green = null; return null; }
    if (tapped === view.round) return null;
    if (green === null) { green = now; wait = randomly(6) === 0 ? between(randomly, 380, 460) : between(randomly, 235, 330); }
    if (now - green < wait) return null;
    tapped = view.round!;
    return { move: { round: view.round! } };
  };
}

// Typing: about 45 words a minute, a little uneven.
function typing(randomly: Random): Bot {
  let done = 0, last: number | null = null, sent = 0;
  return (view, _me, now) => {
    if (view.startsInMs || !view.text) { last = now; return null; }
    const dt = now - (last ?? now); last = now;
    done += dt / 1000 * (3.2 + randomly(16) / 10);
    const whole = Math.floor(done);
    if (whole >= view.text.length) return { move: { text: view.text } };
    if (whole === sent) return null;
    sent = whole;
    return { steer: { typed: whole } };
  };
}

// Maths: each sum in two and a half to five seconds.
function maths(randomly: Random): Bot {
  let at = -1, since = 0, delay = 0;
  return (view, me, now) => {
    if (view.startsInMs || !view.sums) return null;
    const index = view.answered?.[me] ?? 0;
    if (index >= view.sums.length) return null;
    if (index !== at) { at = index; since = now; delay = between(randomly, 2500, 5000); }
    if (now - since < delay) return null;
    since = now + 10_000;
    return { move: { answer: work(view.sums[index]) } };
  };
}

// Word Hunt: a word every few seconds, mostly short ones.
function words(randomly: Random): Bot {
  let grid = '', found: [string, number[]][] = [], next = 0;
  return (view, _me, now) => {
    if (view.startsInMs || !view.grid) return null;
    if (view.grid.join('') !== grid) {
      grid = view.grid.join('');
      const all = [...solve(view.grid)];
      const short = all.filter(([w]) => w.length <= 4), long = all.filter(([w]) => w.length > 4);
      found = [];
      while ((short.length || long.length) && found.length < 40) {
        const pool = (randomly(5) < 4 && short.length) || !long.length ? short : long;
        found.push(pool.splice(randomly(pool.length), 1)[0]);
      }
      next = now + between(randomly, 2500, 4500);
    }
    if (now < next || found.length === 0) return null;
    next = now + between(randomly, 3500, 6000);
    return { move: { path: found.shift()![1] } };
  };
}

// Pong: the paddle heads for where the ball will cross its end, a little
// off, and no faster than its top speed.
function pong(randomly: Random): Bot {
  let at: number | null = null, last: number | null = null, aim = 0;
  return (view, me, now) => {
    if (!view.ball || !view.paddles) return null;
    const far = view.opponent.uid === me;
    const [d, , vd] = view.ball;
    const coming = far ? vd > 0 : vd < 0;
    const end = far ? LENGTH - PADDLE_AT : PADDLE_AT;
    const target = coming && vd !== 0 ? ballAt(view.ball, (end - d) / vd)[1] + aim : WIDTH / 2;
    if (!coming) aim = (randomly(13) - 6) * 1.1;
    const dt = (now - (last ?? now)) / 1000; last = now;
    const from = at ?? view.paddles[me];
    const step = Math.max(-38 * dt, Math.min(38 * dt, target - from));
    at = from + step;
    if (Math.abs(step) < 0.05) return null;
    return { steer: { x: far ? 1 - at / WIDTH : at / WIDTH } };
  };
}

// Light cycles: rides straight until a wall is near, then turns towards the
// most open space; now and then it turns for no reason at all.
function cycles(randomly: Random): Bot {
  let step = -1;
  return (view, me, now) => {
    void now;
    if (view.phase !== 'riding' || view.steps === step || !view.turns) return null;
    step = view.steps!;
    const walls = new Set<number>();
    let head: [number, number] = [0, 0], dir = 0;
    [view.challenger.uid, view.opponent.uid].forEach((uid, i) => {
      const path = trail(STARTS[i], view.turns![uid] ?? [], view.steps!);
      for (const [x, y] of path) walls.add(y * SIZE + x);
      if (uid === me) {
        head = path[path.length - 1];
        dir = [...(view.turns![uid] ?? [])].reverse()[0]?.[1] ?? STARTS[i][2];
      }
    });
    const free = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE && !walls.has(y * SIZE + x);
    const room = (x: number, y: number) => {
      if (!free(x, y)) return 0;
      const seen = new Set([y * SIZE + x]), queue: [number, number][] = [[x, y]];
      while (queue.length && seen.size < 120) {
        const [cx, cy] = queue.shift()!;
        for (const [mx, my] of MOVES) {
          const [nx, ny] = [cx + mx, cy + my];
          if (free(nx, ny) && !seen.has(ny * SIZE + nx)) { seen.add(ny * SIZE + nx); queue.push([nx, ny]); }
        }
      }
      return seen.size;
    };
    const ahead = (d: number, n = 1) => [head[0] + MOVES[d][0] * n, head[1] + MOVES[d][1] * n] as const;
    const blocked = !free(...ahead(dir)) || !free(...ahead(dir, 2));
    if (!blocked && randomly(25) !== 0) return null;
    const options = [dir, (dir + 1) % 4, (dir + 3) % 4].map(d => ({ d, room: room(...ahead(d)) }));
    const best = options.reduce((a, b) => (b.room > a.room ? b : a));
    return best.d === dir ? null : { steer: { dir: best.d } };
  };
}

export function createBot(game: DuelGame, randomly: Random, script?: number[]): Bot {
  switch (game) {
    case 'ultimate': return turns(randomly, view => ultimateMove(view, view.turn!, randomly));
    case 'connect': return turns(randomly, (view, me) => connectMove(view, me, randomly));
    case 'dots': return turns(randomly, (view, me) => dotsMove(view, me, randomly), [450, 900]);
    case 'mancala': return turns(randomly, (view, me) => mancalaMove(view, me, randomly));
    case 'battleship': {
      // The dev harness opens with a fixed run of shots, so a test knows what lands.
      const opening = [...(script ?? [])];
      return turns(randomly, (view, me) => {
        const them = view.challenger.uid === me ? view.opponent.uid : view.challenger.uid;
        const fired = new Set(view.seas![them].shots.map(s => s.cell));
        while (opening.length && fired.has(opening[0])) opening.shift();
        return opening.shift() ?? battleshipMove(view, me, randomly);
      }, script ? [700, 700] : [600, 1100], script ? [1200, 1200] : [600, 1100]);
    }
    case 'reaction': return reaction(randomly);
    case 'typing': return typing(randomly);
    case 'maths': return maths(randomly);
    case 'words': return words(randomly);
    case 'pong': return pong(randomly);
    case 'cycles': return cycles(randomly);
  }
}
