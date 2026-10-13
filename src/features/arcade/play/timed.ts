import { Play, random, type Match, type Random } from './match.ts';
import type { DuelView } from '../../../types/games.ts';

// A game both sides play at once (Games/TimedPlay.cs): a countdown to the
// start, then the game's own clock, after which the scores decide it.
export const READY_MS = 3000;

export abstract class TimedPlay extends Play {
  turns = false;
  ticks = true;
  abstract readonly limitMs: number;
  startsAt = 0;
  endsAt = 0;
  private left: number | null = null;
  protected randomly: Random = random;

  start(match: Match, randomly: Random, now: number) {
    this.randomly = randomly;
    this.startsAt = now + READY_MS; this.endsAt = this.startsAt + this.limitMs;
    this.begin(match, now);
  }
  protected begin(_match: Match, _now: number) {}
  pause(_match: Match, now: number) { this.left = Math.max(0, this.endsAt - Math.max(now, this.startsAt)); }
  resume(_match: Match, now: number) { this.startsAt = now + READY_MS; this.endsAt = this.startsAt + (this.left ?? this.limitMs); this.left = null; }
  protected abstract scores(match: Match): [number, number];
  tick(match: Match, now: number): boolean { return now >= this.endsAt && match.decide(...this.scores(match)); }
  protected started(now: number) {
    if (now < this.startsAt) throw new Error('Wait for the start');
    if (now >= this.endsAt) throw new Error("Time's up");
  }
  protected clocks(view: DuelView, match: Match, now: number) {
    if (!match.live) return;
    view.startsInMs = match.paused ? READY_MS : Math.max(0, this.startsAt - now);
    view.endsInMs = match.paused ? this.left ?? 0 : Math.max(0, this.endsAt - Math.max(now, this.startsAt));
    view.limitMs = this.limitMs;
  }
}
