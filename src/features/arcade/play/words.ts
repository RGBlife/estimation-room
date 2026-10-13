import { TimedPlay } from './timed.ts';
import { isWord, startsWord } from './wordList.ts';
import type { Match, Random } from './match.ts';
import type { DuelPlay, DuelView } from '../../../types/games.ts';

// Word Hunt (Games/WordHunt.cs): one four-by-four grid for both, eighty
// seconds, words traced through touching letters. Longer words score far more.

export const SIZE = 4;
export const DICE = ['AAEEGN', 'ABBJOO', 'ACHOPS', 'AFFKPS', 'AOOTTW', 'CIMOTU', 'DEILRX', 'DELRVY', 'DISTTY', 'EEGHNW', 'EEINSU', 'EHRTVW', 'EIOSST', 'ELRTTY', 'HIMNQU', 'HLNNRZ'];
export const MINIMUM_WORDS = 30;

export const points = (letters: number) => letters < 3 ? 0 : letters === 3 ? 100 : letters === 4 ? 400 : letters === 5 ? 800 : letters === 6 ? 1400 : letters === 7 ? 1800 : 2200 + 400 * (letters - 8);
export const touching = (a: number, b: number) => a !== b && Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) <= 1 && Math.abs(a % SIZE - b % SIZE) <= 1;
export const spell = (grid: readonly string[], path: readonly number[]) => path.map(c => grid[c]).join('').toLowerCase();

// Every word in a grid, with a path that traces it.
export function solve(grid: readonly string[]): Map<string, number[]> {
  const found = new Map<string, number[]>();
  const path: number[] = [];
  const walk = (cell: number, sofar: string) => {
    const word = sofar + grid[cell].toLowerCase();
    if (!startsWord(word)) return;
    path.push(cell);
    if (word.length >= 3 && isWord(word) && !found.has(word)) found.set(word, [...path]);
    for (let next = 0; next < grid.length; next++) if (!path.includes(next) && touching(cell, next)) walk(next, word);
    path.pop();
  };
  for (let cell = 0; cell < grid.length; cell++) walk(cell, '');
  return found;
}

export function roll(randomly: Random): string[] {
  for (;;) {
    const dice = [...DICE];
    const grid = Array.from({ length: SIZE * SIZE }, () => {
      const die = dice.splice(randomly(dice.length), 1)[0];
      const face = die[randomly(6)];
      return face === 'Q' ? 'QU' : face;
    });
    if (solve(grid).size >= MINIMUM_WORDS) return grid;
  }
}

export class WordHunt extends TimedPlay {
  readonly limitMs = 80_000;
  grid: string[] = [];
  found: Record<string, string[]> = {};
  score = (uid: string) => this.found[uid].reduce((sum, w) => sum + points(w.length), 0);

  protected begin(match: Match) {
    this.grid = roll(this.randomly);
    for (const side of match.sides) this.found[side.uid] = [];
  }

  move(_match: Match, uid: string, move: DuelPlay, now: number) {
    this.started(now);
    const path = 'path' in move ? move.path : null;
    if (!path || path.length < 1 || path.length > SIZE * SIZE || path.some(c => !Number.isInteger(c) || c < 0 || c >= SIZE * SIZE)) throw new Error('Trace a word through the letters');
    if (new Set(path).size !== path.length || path.some((c, i) => i > 0 && !touching(path[i - 1], c))) throw new Error('Letters in a word must touch');
    const word = spell(this.grid, path);
    if (word.length < 3) throw new Error('Words have three letters or more');
    if (!isWord(word)) throw new Error('Not in the word list');
    if (this.found[uid].includes(word)) throw new Error('Already found');
    this.found[uid].push(word);
    return false;
  }
  protected scores(match: Match): [number, number] { return [this.score(match.challenger.uid), this.score(match.opponent.uid)]; }

  show(view: DuelView, match: Match, viewer: string, now: number) {
    this.clocks(view, match, now);
    view.grid = [...this.grid];
    view.scores = match.bySide(s => this.score(s.uid));
    view.counts = match.bySide(s => this.found[s.uid].length);
    view.words = match.bySide(s => s.uid === viewer || !match.live ? [...this.found[s.uid]] : null);
  }
}
