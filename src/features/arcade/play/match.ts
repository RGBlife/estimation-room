import type { DuelGame, DuelOptions, DuelPlay, DuelStatus, DuelSteer, DuelView, Mark } from '../../../types/games.ts';

// A duel played in this browser: against the computer, or (in the dev
// harness) against a stand-in for someone at the table. The rules are the
// room service's own (scrum-poker-backend Duels.cs and Games/), move for
// move, so a game looks and plays the same either way.

export type Random = (n: number) => number;
export const random: Random = n => Math.floor(Math.random() * n);

// How long a turn lasts; matches Duels.TurnMs.
export const TURN_MS = 60_000;
// How often games that move by themselves are moved on; matches Duels.TickMs.
export const TICK_MS = 50;

export interface Side { uid: string; name: string; mark?: Mark }

// A game's own rules and pieces, as in DuelPlay on the service.
export abstract class Play {
  turns = true;
  ticks = false;
  get marks() { return this.turns; }
  start(_match: Match, _random: Random, _now: number): void {}
  // The mover's move; returns true when the game is over.
  move(_match: Match, _uid: string, _move: DuelPlay, _now: number): boolean { throw new Error('This game is steered'); }
  steer(_match: Match, _uid: string, _input: DuelSteer, _now: number): void { throw new Error("This game isn't steered"); }
  // Moves the game on; returns true when everyone should see a new state.
  tick(_match: Match, _now: number): boolean { return false; }
  // What moved since the last tick, or null.
  frame(_match: Match, _now: number): Partial<DuelView> | null { return null; }
  pause(_match: Match, _now: number): void {}
  resume(_match: Match, _now: number): void {}
  abstract show(view: DuelView, match: Match, viewer: string, now: number): void;
}

export class Match {
  status: DuelStatus = 'playing';
  turn?: string;
  turnStartedAt = 0;
  paused = false;
  winner?: string;
  line?: number[];
  reason?: DuelView['reason'];
  readonly challenger: Side;
  readonly opponent: Side;
  readonly id: string;
  readonly game: DuelGame;
  readonly play: Play;
  readonly stake: number;
  readonly options?: DuelOptions;

  constructor(id: string, game: DuelGame, challenger: Side, opponent: Side, play: Play, stake = 0, options?: DuelOptions) {
    this.id = id; this.game = game; this.play = play; this.stake = stake; this.options = options;
    this.challenger = { ...challenger }; this.opponent = { ...opponent };
  }

  get sides(): [Side, Side] { return [this.challenger, this.opponent]; }
  get live() { return this.status === 'playing'; }
  side(uid: string): Side {
    if (this.challenger.uid === uid) return this.challenger;
    if (this.opponent.uid === uid) return this.opponent;
    throw new Error("This isn't your duel");
  }
  other(uid: string): Side { return this.challenger.uid === uid ? this.opponent : this.challenger; }
  has(uid: string) { return this.challenger.uid === uid || this.opponent.uid === uid; }

  win(uid: string, reason: DuelView['reason'] = 'played', line?: number[]) { this.status = 'won'; this.winner = uid; this.reason = reason; this.line = line; this.turn = undefined; }
  draw() { this.status = 'drawn'; this.reason = 'draw'; this.turn = undefined; }
  pass(uid: string, now: number) { this.turn = this.other(uid).uid; this.turnStartedAt = now; }
  // Both played at once: the higher score wins, a level one draws.
  decide(challenger: number, opponent: number): true {
    if (challenger === opponent) this.draw();
    else this.win(challenger > opponent ? this.challenger.uid : this.opponent.uid);
    return true;
  }
  // A value per side, by uid.
  bySide<T>(value: (side: Side) => T): Record<string, T> {
    return Object.fromEntries(this.sides.map(s => [s.uid, value(s)]));
  }

  view(now: number, viewer: string): DuelView {
    const person = (side: Side) => ({ uid: side.uid, name: side.name, ...(side.mark ? { mark: side.mark } : {}) });
    const view: DuelView = {
      id: this.id, game: this.game, status: this.status, stake: this.stake,
      challenger: person(this.challenger), opponent: person(this.opponent), paused: this.paused,
    };
    if (this.status === 'playing' && this.turn) {
      view.turn = this.turn;
      if (!this.paused) view.turnLeftMs = Math.max(0, this.turnStartedAt + TURN_MS - now);
    }
    if (this.options) view.options = { ...this.options };
    if (this.winner) view.winner = this.winner;
    if (this.line) view.line = [...this.line];
    if (this.reason) view.reason = this.reason;
    this.play.show(view, this, viewer, now);
    return view;
  }
}

// Sets the game up: who goes first (X in the board games), then its pieces.
export function startMatch(match: Match, randomly: Random, now: number, first = randomly(2) === 0 ? match.challenger : match.opponent) {
  if (match.play.marks) { first.mark = 'X'; match.other(first.uid).mark = 'O'; }
  match.status = 'playing';
  if (match.play.turns) { match.turn = first.uid; match.turnStartedAt = now; }
  match.play.start(match, randomly, now);
}

export function moveMatch(match: Match, uid: string, move: DuelPlay, now: number): boolean {
  if (match.status !== 'playing' || !match.has(uid)) throw new Error("This duel isn't being played");
  if (match.paused) throw new Error('Play resumes at the next reveal');
  if (match.play.turns && match.turn !== uid) throw new Error("It's not your turn");
  return match.play.move(match, uid, move, now);
}

export function steerMatch(match: Match, uid: string, input: DuelSteer, now: number) {
  if (match.status !== 'playing' || match.paused || !match.has(uid)) return;
  match.play.steer(match, uid, input, now);
}

// The three in a row of noughts and crosses.
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
