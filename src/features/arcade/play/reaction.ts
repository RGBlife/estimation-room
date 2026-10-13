import { TimedPlay } from './timed.ts';
import type { Match } from './match.ts';
import type { DuelPlay, DuelView } from '../../../types/games.ts';

// A reaction duel (Games/ReactionDuel.cs): wait for green, first to tap
// takes the round; tap before it and the round goes to the other. Best of five.

export const FIRST_TO = 3;
export const MIN_WAIT_MS = 1500, MAX_WAIT_MS = 4500, RESULT_MS = 2000, VOID_MS = 5000;

export class ReactionDuel extends TimedPlay {
  readonly limitMs = 120_000;
  round = 1;
  phase: 'ready' | 'wait' | 'go' | 'result' = 'ready';
  won: Record<string, number> = {};
  result?: DuelView['result'];
  private goAt = 0;
  private wentAt = 0;
  private nextAt = 0;

  protected begin(match: Match) { for (const side of match.sides) this.won[side.uid] = 0; }
  resume(match: Match, now: number) { super.resume(match, now); this.phase = 'ready'; }

  private wait(now: number) { this.phase = 'wait'; this.goAt = now + MIN_WAIT_MS + this.randomly(MAX_WAIT_MS - MIN_WAIT_MS); }

  tick(match: Match, now: number) {
    if (super.tick(match, now)) return true;
    if (this.phase === 'ready' && now >= this.startsAt) { this.wait(now); return true; }
    if (this.phase === 'wait' && now >= this.goAt) { this.phase = 'go'; this.wentAt = now; return true; }
    if (this.phase === 'go' && now >= this.wentAt + VOID_MS) { this.phase = 'result'; this.result = { void: true }; this.nextAt = now + RESULT_MS; return true; }
    if (this.phase === 'result' && now >= this.nextAt) { this.round++; this.wait(now); return true; }
    return false;
  }

  move(match: Match, uid: string, move: DuelPlay, now: number) {
    this.started(now);
    // A tap meant for a round that's over, or before the first: no harm done.
    if (!('round' in move) || move.round !== this.round || (this.phase !== 'wait' && this.phase !== 'go')) return false;
    const other = match.other(uid).uid;
    const winner = this.phase === 'go' ? uid : other;
    this.result = this.phase === 'go' ? { winner: uid, ms: now - this.wentAt } : { winner: other, early: uid };
    this.phase = 'result'; this.nextAt = now + RESULT_MS;
    if (++this.won[winner] < FIRST_TO) return false;
    match.win(winner);
    return true;
  }
  protected scores(match: Match): [number, number] { return [this.won[match.challenger.uid], this.won[match.opponent.uid]]; }

  show(view: DuelView, match: Match, _viewer: string, now: number) {
    this.clocks(view, match, now);
    view.round = this.round;
    view.phase = this.phase;
    view.won = match.bySide(s => this.won[s.uid]);
    if (this.result) view.result = { ...this.result };
  }
}
