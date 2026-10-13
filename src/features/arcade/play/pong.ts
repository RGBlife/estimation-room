import { TimedPlay } from './timed.ts';
import type { Match } from './match.ts';
import type { DuelSteer, DuelView } from '../../../types/games.ts';

// Pong, first to five (Games/Pong.cs). The court runs from the challenger's
// end (0) to the opponent's (LENGTH), WIDTH across; each side steers its
// paddle and sees itself at the near end.

export const LENGTH = 100, WIDTH = 60, REACH = 8, RADIUS = 1.5, PADDLE_AT = 4;
export const SERVE = 45, SPEED_UP = 1.07, MAX_SPEED = 115;
export const FIRST_TO = 5;
export const SERVE_MS = 1200, STEP_MS = 10;

// Where the ball will be `seconds` from now, bouncing off the sides: for
// drawing between frames, and for the computer's paddle.
export function ballAt(ball: readonly [number, number, number, number], seconds: number): [number, number] {
  const [d, l, vd, vl] = ball;
  const span = WIDTH - 2 * RADIUS;
  let across = (l - RADIUS + vl * seconds) % (2 * span);
  if (across < 0) across += 2 * span;
  if (across > span) across = 2 * span - across;
  return [d + vd * seconds, across + RADIUS];
}

export class Pong extends TimedPlay {
  readonly limitMs = 180_000;
  d = LENGTH / 2; l = WIDTH / 2; vd = 0; vl = 0;
  paddles: Record<string, number> = {};
  points: Record<string, number> = {};
  serveAt = 0;
  private receiver = '';
  private steppedTo = 0;
  private moved = true;

  protected begin(match: Match, now: number) {
    for (const side of match.sides) { this.paddles[side.uid] = WIDTH / 2; this.points[side.uid] = 0; }
    this.receiver = this.randomly(2) === 0 ? match.challenger.uid : match.opponent.uid;
    this.serveAt = this.startsAt; this.steppedTo = now;
  }
  resume(match: Match, now: number) {
    super.resume(match, now);
    this.d = LENGTH / 2; this.l = WIDTH / 2; this.vd = this.vl = 0; this.serveAt = this.startsAt; this.steppedTo = now; this.moved = true;
  }

  // Each side steers from its own end: across is mirrored for the far one.
  steer(match: Match, uid: string, input: DuelSteer) {
    if (!('x' in input) || !Number.isFinite(input.x)) return;
    let across = Math.max(0, Math.min(1, input.x));
    if (uid === match.opponent.uid) across = 1 - across;
    this.paddles[uid] = Math.max(REACH, Math.min(WIDTH - REACH, across * WIDTH));
    this.moved = true;
  }

  tick(match: Match, now: number) {
    if (super.tick(match, now)) return true;
    let changed = false;
    if (this.vd === 0 && now >= this.serveAt) {
      // Off from the middle towards the receiver, at up to 35 degrees.
      const angle = (this.randomly(71) - 35) * Math.PI / 180;
      const towards = this.receiver === match.challenger.uid ? -1 : 1;
      this.vd = towards * SERVE * Math.cos(angle); this.vl = SERVE * Math.sin(angle);
      this.steppedTo = now; this.moved = true;
    }
    while (this.vd !== 0 && this.steppedTo + STEP_MS <= now) {
      this.steppedTo += STEP_MS;
      const scorer = this.step(match, STEP_MS / 1000);
      if (scorer) {
        changed = true;
        if (++this.points[scorer] >= FIRST_TO) { match.win(scorer); return true; }
        this.receiver = match.other(scorer).uid;
        this.d = LENGTH / 2; this.l = WIDTH / 2; this.vd = this.vl = 0; this.serveAt = now + SERVE_MS;
        break;
      }
    }
    if (this.vd === 0) this.steppedTo = now;
    return changed;
  }

  // Moves the ball on; returns who scored, if anyone.
  private step(match: Match, seconds: number): string | null {
    this.d += this.vd * seconds; this.l += this.vl * seconds;
    if (this.l < RADIUS) { this.l = 2 * RADIUS - this.l; this.vl = -this.vl; }
    if (this.l > WIDTH - RADIUS) { this.l = 2 * (WIDTH - RADIUS) - this.l; this.vl = -this.vl; }
    this.moved = true;
    for (const [side, end, dir] of [[match.challenger, PADDLE_AT, 1], [match.opponent, LENGTH - PADDLE_AT, -1]] as const) {
      if (Math.sign(this.vd) === dir || Math.abs(this.d - end) > RADIUS + 2.5 || dir * (this.d - end) > RADIUS) continue;
      const offset = (this.l - this.paddles[side.uid]) / (REACH + RADIUS);
      if (Math.abs(offset) > 1) continue;
      const speed = Math.min(Math.hypot(this.vd, this.vl) * SPEED_UP, MAX_SPEED);
      const angle = offset * 55 * Math.PI / 180;
      this.vd = dir * speed * Math.cos(angle); this.vl = speed * Math.sin(angle);
      this.d = end + dir * RADIUS;
    }
    if (this.d < 0) return match.opponent.uid;
    if (this.d > LENGTH) return match.challenger.uid;
    return null;
  }
  protected scores(match: Match): [number, number] { return [this.points[match.challenger.uid], this.points[match.opponent.uid]]; }

  private court(match: Match, now: number): Partial<DuelView> {
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      ball: [round(this.d), round(this.l), round(this.vd), round(this.vl)],
      paddles: match.bySide(s => round(this.paddles[s.uid])),
      serveInMs: Math.max(0, this.serveAt - now),
    };
  }
  frame(match: Match, now: number) {
    if (!this.moved) return null;
    this.moved = false;
    return this.court(match, now);
  }

  show(view: DuelView, match: Match, _viewer: string, now: number) {
    this.clocks(view, match, now);
    Object.assign(view, this.court(match, now));
    view.points = match.bySide(s => this.points[s.uid]);
  }
}
