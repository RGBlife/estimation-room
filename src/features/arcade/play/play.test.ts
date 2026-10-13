import { beforeAll, describe, expect, it } from 'vitest';
import { Match, moveMatch, startMatch, steerMatch, TICK_MS, type Random } from './match.ts';
import { createPlay, LocalDuel } from './local.ts';
import { UltimateNoughts } from './ultimate.ts';
import { ConnectFour, runThrough, COLUMNS, ROWS } from './connect.ts';
import { DotsAndBoxes, EDGES } from './dots.ts';
import { Mancala } from './mancala.ts';
import { WordHunt, points, solve, touching, MINIMUM_WORDS } from './words.ts';
import { TypingRace, TEXTS, WORD_COUNT } from './typing.ts';
import { SpeedMaths, COUNT, WRONG_MS, work } from './maths.ts';
import { ReactionDuel, RESULT_MS, MAX_WAIT_MS, VOID_MS } from './reaction.ts';
import { Pong, WIDTH, SERVE, FIRST_TO as PONG_TO } from './pong.ts';
import { LightCycles, STEP_MS, RESULT_MS as CYCLE_RESULT_MS, ROUND_READY_MS, trail, STARTS } from './cycles.ts';
import type { TimedPlay } from './timed.ts';
import { setWordList } from './wordList.ts';
import WORDS from '../words/words.txt?raw';
import type { DuelGame, DuelPlay } from '../../../types/games.ts';

// The same rules as the room service, checked the same way (its
// tests/Program.cs): Ann (a) moves first, as X, and the clock is moved by hand.
const T0 = 1_000_000;
const seeded = (seed: number): Random => {
  let s = seed;
  return n => { s = (s * 1103515245 + 12345) % 2 ** 31; return s % n; };
};
function fresh(game: DuelGame, seed = 7) {
  const match = new Match('g', game, { uid: 'a', name: 'Ann' }, { uid: 'b', name: 'Ben' }, createPlay(game));
  startMatch(match, seeded(seed), T0, match.challenger);
  return match;
}
const cell = (c: number) => ({ cell: c });
const play = (match: Match, uid: string, move: DuelPlay, at = T0) => moveMatch(match, uid, move, at);
const begins = (match: Match) => (match.play as TimedPlay).startsAt;

beforeAll(() => {
  setWordList(WORDS.split('\n').filter(Boolean));
});

describe('ultimate noughts and crosses', () => {
  const SCRIPT = [56, 25, 66, 33, 62, 78, 59, 53, 73, 15, 69, 71, 76, 43, 63, 8, 79];
  it('sends the other player to the board matching the square', () => {
    const match = fresh('ultimate');
    play(match, 'a', cell(SCRIPT[0]));
    expect((match.play as UltimateNoughts).forced).toBe(2);
    expect(() => play(match, 'b', cell(0))).toThrow('Play in the highlighted board');
    expect(match.view(T0, 'b').forced).toBe(2);
  });
  it('lets a won board send the next player anywhere, and takes no more marks', () => {
    const match = fresh('ultimate');
    SCRIPT.slice(0, 10).forEach((c, i) => play(match, i % 2 ? 'b' : 'a', cell(c)));
    const u = match.play as UltimateNoughts;
    expect(u.boards[6]).toBe('X');
    expect(u.forced).toBeNull();
    expect(() => play(match, 'a', cell(60))).toThrow('Choose an empty square');
  });
  it('is won with three small boards in a row', () => {
    const match = fresh('ultimate');
    SCRIPT.forEach((c, i) => play(match, i % 2 ? 'b' : 'a', cell(c)));
    expect(match.status).toBe('won');
    expect(match.winner).toBe('a');
    expect(match.line).toEqual([6, 7, 8]);
  });
});

describe('Connect Four', () => {
  it('counts a diagonal of four', () => {
    const squares = Array(COLUMNS * ROWS).fill(null);
    for (const s of [35, 29, 23, 17]) squares[s] = 'X';
    expect(runThrough(squares, 23)).toEqual([17, 23, 29, 35]);
  });
  it('stacks counters up a column until it is full', () => {
    const match = fresh('connect');
    for (let i = 0; i < ROWS; i++) play(match, i % 2 ? 'b' : 'a', cell(0));
    expect(() => play(match, 'a', cell(0))).toThrow('That column is full');
    expect((match.play as ConnectFour).squares[35]).toBe('X');
  });
  it('is won with four down a column', () => {
    const match = fresh('connect');
    [0, 1, 0, 1, 0, 1, 0].forEach((c, i) => play(match, i % 2 ? 'b' : 'a', cell(c)));
    expect(match.winner).toBe('a');
    expect(match.line).toEqual([14, 21, 28, 35]);
  });
  it('draws when the board fills with no four', () => {
    const match = fresh('connect');
    [3, 5, 6, 4, 3, 1, 2, 0, 0, 1, 3, 1, 2, 6, 4, 6, 2, 4, 6, 5, 4, 5, 6, 4, 6, 2, 2, 0, 2, 4, 5, 5, 0, 5, 1, 3, 1, 0, 3, 3, 1, 0]
      .forEach((c, i) => play(match, i % 2 ? 'b' : 'a', cell(c)));
    expect(match.status).toBe('drawn');
  });
});

describe('dots and boxes', () => {
  it('gives a closed box to whoever closed it, and another line', () => {
    const match = fresh('dots');
    play(match, 'a', cell(0)); play(match, 'b', cell(4)); play(match, 'a', cell(20)); play(match, 'b', cell(21));
    expect((match.play as DotsAndBoxes).boxes[0]).toBe('O');
    expect(match.turn).toBe('b');
    expect(() => play(match, 'b', cell(0))).toThrow('That line is drawn');
  });
  it('ends with every line drawn, most boxes winning', () => {
    const match = fresh('dots');
    const d = match.play as DotsAndBoxes;
    for (let edge = 0; edge < EDGES && match.live; edge++) if (!d.edges[edge]) play(match, match.turn!, cell(edge));
    const count = (mark: string) => d.boxes.filter(b => b === mark).length;
    expect(d.boxes.every(Boolean)).toBe(true);
    if (match.status === 'drawn') expect(count('X')).toBe(count('O'));
    else expect(count(match.side(match.winner!).mark!)).toBeGreaterThan(8);
  });
});

describe('mancala', () => {
  it('gives another turn for the last seed in your store', () => {
    const match = fresh('mancala');
    play(match, 'a', cell(2));
    expect((match.play as Mancala).board.slice(0, 7)).toEqual([4, 4, 0, 5, 5, 5, 1]);
    expect(match.turn).toBe('a');
    play(match, 'a', cell(5));
    expect((match.play as Mancala).board.slice(6, 11)).toEqual([2, 5, 5, 5, 5]);
    expect(match.turn).toBe('b');
  });
  it('captures the seeds opposite an empty pit of yours', () => {
    const match = fresh('mancala');
    const board = (match.play as Mancala).board;
    board.fill(0); board[0] = 1; board[4] = 2; board[11] = 5; board[7] = 1;
    play(match, 'a', cell(0));
    expect([board[6], board[1], board[11]]).toEqual([6, 0, 0]);
  });
  it('ends when a side runs out, each banking its own', () => {
    const match = fresh('mancala');
    const board = (match.play as Mancala).board;
    board.fill(0); board[5] = 1; board[6] = 20; board[8] = 3; board[13] = 24;
    play(match, 'a', cell(5));
    expect(match.winner).toBe('b');
    expect([board[6], board[13]]).toEqual([21, 27]);
    expect(() => play(fresh('mancala'), 'a', cell(6))).toThrow('Choose one of your pits');
  });
});

describe('Word Hunt', () => {
  it('rolls a grid rich in words and scores them by length, once each', () => {
    const match = fresh('words');
    const w = match.play as WordHunt;
    const words = solve(w.grid);
    expect(words.size).toBeGreaterThanOrEqual(MINIMUM_WORDS);
    const [longest, path] = [...words].sort((x, y) => y[0].length - x[0].length)[0];
    expect(() => play(match, 'a', { path })).toThrow('Wait for the start');
    const start = begins(match);
    play(match, 'a', { path }, start);
    expect(w.score('a')).toBe(points(longest.length));
    expect(() => play(match, 'a', { path }, start)).toThrow('Already found');
    expect(() => play(match, 'a', { path: [0, 2, 1] }, start)).toThrow('Letters in a word must touch');
    expect(touching(0, 5)).toBe(true);
    expect(touching(0, 2)).toBe(false);
  });
  it('hides your words from the other side until time is up, then decides on the scores', () => {
    const match = fresh('words');
    const w = match.play as WordHunt;
    const [, path] = [...solve(w.grid)][0];
    play(match, 'a', { path }, begins(match));
    expect(match.view(begins(match), 'b').words).toEqual({ a: null, b: [] });
    expect(match.play.tick(match, w.endsAt)).toBe(true);
    expect(match.winner).toBe('a');
    expect(match.view(w.endsAt, 'b').words?.a).toHaveLength(1);
  });
});

describe('typing race', () => {
  it('sends progress as frames, and only the finish completes the line', () => {
    const match = fresh('typing');
    const r = match.play as TypingRace;
    const go = begins(match);
    steerMatch(match, 'a', { typed: 10 }, go);
    expect(match.play.frame(match, go)).toEqual({ typed: { a: 10, b: 0 } });
    expect(match.play.frame(match, go)).toBeNull();
    steerMatch(match, 'a', { typed: 999 }, go);
    expect(r.typed.a).toBe(r.text.length - 1);
    expect(() => play(match, 'b', { text: `${r.text}x` }, go + 30_000)).toThrow("That doesn't match the line");
    expect(() => play(match, 'b', { text: r.text }, go + 100)).toThrow('That was faster than anyone types');
    expect(play(match, 'b', { text: r.text }, go + 30_000)).toBe(true);
    expect(match.winner).toBe('b');
  });
});

describe('typing texts', () => {
  it('types code, a story, a credited quote or a run of common words, as the challenger chose', () => {
    const race = (text: 'code' | 'story' | 'quotes' | 'words') => {
      const match = new Match('t', 'typing', { uid: 'a', name: 'Ann' }, { uid: 'b', name: 'Ben' }, createPlay('typing', undefined, { text }), 0, { text });
      startMatch(match, seeded(3), T0, match.challenger);
      return match.view(T0, 'a');
    };
    expect(TEXTS.code).toContain(race('code').text);
    expect(TEXTS.story).toContain(race('story').text);
    const quote = race('quotes');
    expect(TEXTS.quotes.find(q => q.text === quote.text)?.by).toBe(quote.credit);
    expect(quote.options).toEqual({ text: 'quotes' });
    const words = race('words').text!.split(' ');
    expect(words).toHaveLength(WORD_COUNT);
    expect(words.every(w => TEXTS.words.includes(w))).toBe(true);
  });
});

describe('speed maths', () => {
  it('holds you up after a wrong answer, and the first to ten wins', () => {
    const match = fresh('maths');
    const m = match.play as SpeedMaths;
    const go = begins(match);
    expect(m.sums.every(s => work(s.text) === s.answer && s.answer > 0)).toBe(true);
    expect(() => play(match, 'a', { answer: m.sums[0].answer + 1 }, go)).toThrow('Not quite');
    expect(() => play(match, 'a', { answer: m.sums[0].answer }, go + 100)).toThrow('Steady');
    play(match, 'a', { answer: m.sums[0].answer }, go + WRONG_MS);
    expect(m.answered).toEqual({ a: 1, b: 0 });
    for (let i = 0; i < COUNT; i++) play(match, 'b', { answer: m.sums[i].answer }, go + 2000);
    expect(match.winner).toBe('b');
  });
});

describe('reaction duel', () => {
  it('gives the round away for an early tap, to the first on green, and plays a void round again', () => {
    const match = fresh('reaction');
    const r = match.play as ReactionDuel;
    let now = begins(match);
    match.play.tick(match, now);
    expect(r.phase).toBe('wait');
    play(match, 'b', { round: 1 }, now + 100);
    expect(r.result).toEqual({ winner: 'a', early: 'b' });
    expect(play(match, 'a', { round: 1 }, now + 200)).toBe(false);
    const round = (winner: string) => {
      now += RESULT_MS + 500; match.play.tick(match, now);
      now += MAX_WAIT_MS; match.play.tick(match, now);
      play(match, winner, { round: r.round }, now + 230);
    };
    round('b');
    expect(r.result).toEqual({ winner: 'b', ms: 230 });
    now += RESULT_MS + 500; match.play.tick(match, now); now += MAX_WAIT_MS; match.play.tick(match, now);
    now += VOID_MS; match.play.tick(match, now);
    expect(r.result).toEqual({ void: true });
    round('b'); round('b');
    expect(match.winner).toBe('b');
  });
});

describe('Pong', () => {
  it('mirrors the far side, returns the ball off a paddle faster, and is won at five', () => {
    const match = fresh('pong');
    const p = match.play as Pong;
    let now = begins(match);
    steerMatch(match, 'b', { x: 0.25 }, now);
    expect(p.paddles.b).toBe(WIDTH * 0.75);
    for (let i = 0; i < 400; i++) {
      now += TICK_MS;
      steerMatch(match, 'a', { x: p.l / WIDTH }, now);
      steerMatch(match, 'b', { x: 1 - p.l / WIDTH }, now);
      match.play.tick(match, now);
    }
    expect(p.points).toEqual({ a: 0, b: 0 });
    expect(Math.hypot(p.vd, p.vl)).toBeGreaterThan(SERVE * 1.5);
    steerMatch(match, 'a', { x: p.l < WIDTH / 2 ? 1 : 0 }, now);
    steerMatch(match, 'b', { x: p.l < WIDTH / 2 ? 0 : 1 }, now);
    for (let i = 0; i < 4000 && match.live; i++) { now += TICK_MS; match.play.tick(match, now); }
    expect(p.points[match.winner!]).toBe(PONG_TO);
  });
});

describe('light cycles', () => {
  it('rides, crashes into walls, ignores turning back, and draws the same trail from the turns', () => {
    const match = fresh('cycles');
    const c = match.play as LightCycles;
    let at = begins(match);
    const ride = (steps: number) => { for (let i = 0; i < steps; i++) { match.play.tick(match, at); at += STEP_MS; } };
    ride(21);
    expect(c.crashed).toEqual(['a', 'b']);
    expect(c.won).toEqual({ a: 0, b: 0 });
    at += CYCLE_RESULT_MS; match.play.tick(match, at); at += ROUND_READY_MS;
    steerMatch(match, 'a', { dir: 3 }, at);
    steerMatch(match, 'a', { dir: 2 }, at);
    ride(12);
    expect(c.turned.a).toEqual([[1, 2]]);
    expect(c.crashed).toEqual(['a']);
    expect(c.won.b).toBe(1);
    expect(trail(STARTS[0], c.turned.a, 3)).toEqual([[4, 16], [4, 17], [4, 18], [4, 19]]);
  });
});

describe('the computer', () => {
  // The computer plays each game out against a careless player (the first
  // legal move in turn games, nothing at all in the rest): it never makes a
  // move the rules refuse that stalls the game, and every game ends.
  const games: DuelGame[] = ['ultimate', 'connect', 'battleship', 'dots', 'mancala', 'reaction', 'typing', 'maths', 'pong', 'cycles', 'words'];
  it.each(games)('plays %s through to the end', game => {
    const local = new LocalDuel(game, { uid: 'a', name: 'Ann' }, { uid: 'b', name: 'Ben' }, 'b', { randomly: seeded(3) }, T0);
    let now = T0;
    for (let i = 0; i < 20_000 && !local.over; i++) {
      now += TICK_MS;
      local.tick(now);
      const view = local.view('a', now);
      try {
        if (view.turn === 'a' && game !== 'battleship') {
          const tries = Array.from({ length: 90 }, (_, c) => c);
          for (const c of tries) { try { local.move('a', { cell: c }, now); break; } catch { /* not that one */ } }
        } else if (view.turn === 'a') {
          const fired = new Set(view.seas!.b.shots.map(s => s.cell));
          local.move('a', { cell: Array.from({ length: 36 }, (_, c) => c).find(c => !fired.has(c))! }, now);
        }
      } catch { /* refused: try again next tick */ }
    }
    expect(local.over).toBe(true);
  });
});
