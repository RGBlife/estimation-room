import { TimedPlay } from './timed.ts';
import type { Match, Random } from './match.ts';
import type { DuelPlay, DuelView } from '../../../types/games.ts';

// Speed maths (Games/SpeedMaths.cs): the same ten sums for both; first to
// answer all ten wins. A wrong answer holds you up for a moment.

export const COUNT = 10;
export const WRONG_MS = 800;

export function generate(randomly: Random): { text: string; answer: number }[] {
  const between = (low: number, high: number) => low + randomly(high - low + 1);
  const kinds = ['+', '+', '+', '−', '−', '−', '×', '×', '÷', '÷'];
  const sums: { text: string; answer: number }[] = [];
  while (kinds.length > 0) {
    const kind = kinds.splice(randomly(kinds.length), 1)[0];
    if (kind === '+') { const a = between(12, 89), b = between(12, 89); sums.push({ text: `${a} + ${b}`, answer: a + b }); }
    else if (kind === '−') { const a = between(30, 99), b = between(11, a - 5); sums.push({ text: `${a} − ${b}`, answer: a - b }); }
    else if (kind === '×') { const a = between(3, 12), b = between(3, 12); sums.push({ text: `${a} × ${b}`, answer: a * b }); }
    else { const a = between(3, 12), b = between(3, 12); sums.push({ text: `${a * b} ÷ ${a}`, answer: b }); }
  }
  return sums;
}

// The answer to a sum as shown, for the computer, which reads it like anyone else.
export function work(text: string): number {
  const [a, op, b] = text.split(' ');
  const x = Number(a), y = Number(b);
  return op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y;
}

export class SpeedMaths extends TimedPlay {
  readonly limitMs = 120_000;
  sums: { text: string; answer: number }[] = [];
  answered: Record<string, number> = {};
  private heldUntil: Record<string, number> = {};

  protected begin(match: Match) {
    this.sums = generate(this.randomly);
    for (const side of match.sides) this.answered[side.uid] = 0;
  }

  move(match: Match, uid: string, move: DuelPlay, now: number) {
    this.started(now);
    if (now < (this.heldUntil[uid] ?? 0)) throw new Error('Steady');
    const answer = 'answer' in move ? move.answer : NaN;
    if (!Number.isInteger(answer)) throw new Error('Type a number');
    if (answer !== this.sums[this.answered[uid]].answer) { this.heldUntil[uid] = now + WRONG_MS; throw new Error('Not quite'); }
    if (++this.answered[uid] < COUNT) return false;
    match.win(uid);
    return true;
  }
  protected scores(match: Match): [number, number] { return [this.answered[match.challenger.uid], this.answered[match.opponent.uid]]; }

  show(view: DuelView, match: Match, _viewer: string, now: number) {
    this.clocks(view, match, now);
    view.sums = this.sums.map(s => s.text);
    view.answered = match.bySide(s => this.answered[s.uid]);
  }
}
