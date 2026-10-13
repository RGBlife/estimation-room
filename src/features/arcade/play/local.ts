import { Match, moveMatch, random, startMatch, steerMatch, TICK_MS, type Play, type Random, type Side } from './match.ts';
import { createBot, type Bot } from './bots.ts';
import { UltimateNoughts } from './ultimate.ts';
import { ConnectFour } from './connect.ts';
import { Battleship } from './battleship.ts';
import { DotsAndBoxes } from './dots.ts';
import { Mancala } from './mancala.ts';
import { WordHunt } from './words.ts';
import { ReactionDuel } from './reaction.ts';
import { TypingRace } from './typing.ts';
import { SpeedMaths } from './maths.ts';
import { Pong } from './pong.ts';
import { LightCycles } from './cycles.ts';
import type { DuelFrame, DuelGame, DuelOptions, DuelPlay, DuelSteer, DuelView } from '../../../types/games.ts';

export function createPlay(game: DuelGame, fleets?: number[][][], options?: DuelOptions): Play {
  switch (game) {
    case 'ultimate': return new UltimateNoughts();
    case 'connect': return new ConnectFour();
    case 'battleship': return new Battleship(fleets);
    case 'dots': return new DotsAndBoxes();
    case 'mancala': return new Mancala();
    case 'words': return new WordHunt();
    case 'reaction': return new ReactionDuel();
    case 'typing': return new TypingRace(options?.text);
    case 'maths': return new SpeedMaths();
    case 'pong': return new Pong();
    case 'cycles': return new LightCycles();
  }
}

export const COMPUTER: Side = { uid: 'computer', name: 'Computer' };

interface Options {
  id?: string;
  // Who goes first; at random otherwise.
  first?: 'challenger' | 'opponent';
  randomly?: Random;
  // Battleship: fixed fleets (the dev harness's, so a test knows where to aim)
  // and the computer's opening shots.
  fleets?: number[][][];
  script?: number[];
  stake?: number;
  // The challenger's choices: what a typing race types.
  options?: DuelOptions;
}

// A duel played in this browser: you against the computer, or against the
// dev harness's stand-in. The computer plays the side it's given, as a bot
// called every tick. Changes are announced like the room service's: a full
// state when something happens, frames when only things in motion moved.
export class LocalDuel {
  readonly match: Match;
  private readonly bot: Bot;
  private readonly bots: string;
  private readonly listeners = new Set<(frame?: DuelFrame) => void>();
  private stopped = false;
  version = 0;
  // Its result has gone into your record.
  recorded = false;

  constructor(game: DuelGame, challenger: Side, opponent: Side, bot: string, options: Options = {}, now = performance.now()) {
    const randomly = options.randomly ?? random;
    this.match = new Match(options.id ?? `local-${game}`, game, challenger, opponent, createPlay(game, options.fleets, options.options), options.stake, options.options);
    this.bots = bot;
    this.bot = createBot(game, randomly, options.script);
    const first = options.first && (options.first === 'challenger' ? this.match.challenger : this.match.opponent);
    startMatch(this.match, randomly, now, first);
  }

  get over() { return !this.match.live; }
  view(viewer: string, now = performance.now()): DuelView { return this.match.view(now, viewer); }
  subscribe(listener: (frame?: DuelFrame) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private announce(frame?: DuelFrame) { this.version++; this.listeners.forEach(l => l(frame)); }

  move(uid: string, play: DuelPlay, now = performance.now()) {
    moveMatch(this.match, uid, play, now);
    this.announce();
  }
  steer(uid: string, input: DuelSteer, now = performance.now()) { steerMatch(this.match, uid, input, now); }
  resign(uid: string) {
    if (!this.match.live) return;
    this.match.win(this.match.other(uid).uid, 'resigned');
    this.announce();
  }

  // The next round: the board waits, clocks stopped, until the reveal.
  pause(now = performance.now()) {
    if (!this.match.live || this.match.paused) return;
    this.match.paused = true; this.match.play.pause(this.match, now); this.announce();
  }
  resume(now = performance.now()) {
    if (!this.match.paused) return;
    this.match.paused = false; this.match.turnStartedAt = now; this.match.play.resume(this.match, now); this.announce();
  }

  // One tick of the duel clock: the game moves on, then the computer plays.
  tick(now = performance.now()) {
    const match = this.match;
    if (!match.live || match.paused) return;
    let changed = match.play.ticks && match.play.tick(match, now);
    if (match.live) {
      const act = this.bot(match.view(now, this.bots), this.bots, now);
      try {
        if (act && 'move' in act) { moveMatch(match, this.bots, act.move, now); changed = true; }
        if (act && 'steer' in act) steerMatch(match, this.bots, act.steer, now);
      } catch { /* A move the rules refuse is the computer's loss, not the page's. */ }
    }
    if (changed || !match.live) { match.play.frame(match, now); this.announce(); return; }
    const frame = match.play.frame(match, now);
    if (frame) this.announce({ ...frame, id: match.id });
  }

  // Ticks on the duel clock until stopped.
  run(): () => void {
    this.stopped = false;
    const timer = setInterval(() => { if (!this.stopped) this.tick(); }, TICK_MS);
    return () => { this.stopped = true; clearInterval(timer); };
  }
}
