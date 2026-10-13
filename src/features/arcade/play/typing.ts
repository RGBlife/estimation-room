import { TimedPlay } from './timed.ts';
import type { Match } from './match.ts';
import TYPING from '../words/typing.json';
import type { DuelPlay, DuelSteer, DuelView, TypingKind } from '../../../types/games.ts';

// A typing race (Games/TypingRace.cs): the same line for both, of the kind
// the challenger picked; first to type it exactly wins.

// The texts, shared with the room service (Puzzles/typing.json there).
export const TEXTS = TYPING as { code: string[]; story: string[]; quotes: { text: string; by: string }[]; words: string[] };
export const KINDS: TypingKind[] = ['code', 'story', 'quotes', 'words'];
// How many words a run of common words has.
export const WORD_COUNT = 20;
// 25 characters a second is 300 words a minute: nobody types faster.
export const MAX_CHARS_PER_SECOND = 25;

export { wpm } from './speed.ts';

export class TypingRace extends TimedPlay {
  readonly limitMs = 90_000;
  readonly kind: TypingKind;
  text = '';
  credit?: string;
  typed: Record<string, number> = {};
  finished: Record<string, number> = {};
  private moved = false;
  constructor(kind: TypingKind = 'code') { super(); this.kind = kind; }

  protected begin(match: Match) {
    if (this.kind === 'words') this.text = Array.from({ length: WORD_COUNT }, () => TEXTS.words[this.randomly(TEXTS.words.length)]).join(' ');
    else if (this.kind === 'quotes') { const quote = TEXTS.quotes[this.randomly(TEXTS.quotes.length)]; this.text = quote.text; this.credit = quote.by; }
    else { const lines = TEXTS[this.kind]; this.text = lines[this.randomly(lines.length)]; }
    for (const side of match.sides) this.typed[side.uid] = 0;
  }

  steer(_match: Match, uid: string, input: DuelSteer, now: number) {
    if (now < this.startsAt || now >= this.endsAt || !('typed' in input)) return;
    const typed = Math.max(0, Math.min(this.text.length - 1, Math.floor(input.typed)));
    if (typed !== this.typed[uid]) { this.typed[uid] = typed; this.moved = true; }
  }

  move(match: Match, uid: string, move: DuelPlay, now: number) {
    this.started(now);
    if (!('text' in move) || move.text !== this.text) throw new Error("That doesn't match the line");
    const took = now - this.startsAt;
    if (took * MAX_CHARS_PER_SECOND < this.text.length * 1000) throw new Error('That was faster than anyone types');
    this.typed[uid] = this.text.length; this.finished[uid] = took;
    match.win(uid);
    return true;
  }
  protected scores(match: Match): [number, number] { return [this.typed[match.challenger.uid], this.typed[match.opponent.uid]]; }

  frame(match: Match) {
    if (!this.moved) return null;
    this.moved = false;
    return { typed: match.bySide(s => this.typed[s.uid]) };
  }

  show(view: DuelView, match: Match, _viewer: string, now: number) {
    this.clocks(view, match, now);
    view.text = this.text;
    view.kind = this.kind;
    if (this.credit) view.credit = this.credit;
    view.typed = match.bySide(s => this.typed[s.uid]);
    if (Object.keys(this.finished).length) view.finished = { ...this.finished };
  }
}
