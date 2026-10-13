import type { DuelGame, DuelOptions } from '../../types/games.ts';

// Every game the Arcade has, in the order its home shows them: solo puzzles
// you play alone for coins, then the duels, quick-fire games played both at
// once and thinky turn games. A duel can be practised against the computer,
// but it's still a duel.
export type ArcadeGame = 'sorted' | 'rare' | DuelGame;

export interface GameInfo {
  name: string;
  // One line under the title on its page.
  rules: string;
  // On its card, until there's something of yours to say instead.
  tagline: string;
  // Quick-fire games are played by both at once, on the duel clock.
  live: boolean;
  // As it reads in "Sam challenges you to …".
  phrase: string;
}

export const DUEL_GAMES: Record<DuelGame, GameInfo> = {
  reaction: { name: 'Reaction duel', rules: 'Wait for green, then tap. Tap early and the round goes to them. Best of five.', tagline: 'Wait for green', live: true, phrase: 'a reaction duel' },
  typing: { name: 'Typing race', rules: 'The same line for both of you: code, a story, a famous quote or common words. First to type it exactly wins.', tagline: 'Race to the end of the line', live: true, phrase: 'a typing race' },
  maths: { name: 'Speed maths', rules: 'Ten quick sums. First to answer all ten wins; a wrong answer holds you up.', tagline: 'First to ten sums', live: true, phrase: 'speed maths' },
  pong: { name: 'Pong', rules: "Keep the ball out of your end. First to five points. Drag, or use ← and →.", tagline: 'First to five', live: true, phrase: 'Pong' },
  cycles: { name: 'Light cycles', rules: 'You leave a wall wherever you ride. Trap them before they trap you. First to two rounds.', tagline: 'Trap them with your trail', live: true, phrase: 'light cycles' },
  ultimate: { name: 'Ultimate noughts and crosses', rules: 'Nine boards in one. Your square sends them to the matching board. Win three boards in a row.', tagline: 'Nine boards in one', live: false, phrase: 'ultimate noughts and crosses' },
  connect: { name: 'Connect Four', rules: 'Drop counters down the columns. Four in a row wins, any direction.', tagline: 'Four in a row', live: false, phrase: 'Connect Four' },
  battleship: { name: 'Battleship', rules: 'Sink all four of their ships first. A hit earns another shot.', tagline: 'Find their fleet', live: false, phrase: 'Battleship' },
  dots: { name: 'Dots and boxes', rules: 'Draw a line between two dots. Close a box to claim it and draw again. Most boxes wins.', tagline: "Don't give away the chain", live: false, phrase: 'dots and boxes' },
  words: { name: 'Word Hunt', rules: 'Trace words through touching letters in 80 seconds. Longer words score far more.', tagline: 'Words against the clock', live: true, phrase: 'Word Hunt' },
  mancala: { name: 'Mancala', rules: 'Sow seeds anticlockwise. Land in your store to go again; land in an empty pit of yours to capture.', tagline: 'Sow, store, capture', live: false, phrase: 'mancala' },
};

export interface Shelf { id: 'puzzles' | 'quick' | 'thinky'; title: string; games: ArcadeGame[] }
export const SECTIONS: { id: 'solo' | 'duels'; title: string; lead: string; shelves: Shelf[] }[] = [
  { id: 'solo', title: 'Solo', lead: 'Just you, for coins', shelves: [{ id: 'puzzles', title: 'Puzzles', games: ['sorted', 'rare'] }] },
  { id: 'duels', title: 'Duels', lead: 'Take on someone at the table, or practise against the computer', shelves: [
    { id: 'quick', title: 'Quick-fire', games: ['reaction', 'typing', 'maths', 'pong', 'cycles'] },
    { id: 'thinky', title: 'Thinky', games: ['ultimate', 'connect', 'battleship', 'dots', 'words', 'mancala'] },
  ] },
];
export const ALL_GAMES: ArcadeGame[] = SECTIONS.flatMap(s => s.shelves.flatMap(shelf => shelf.games));

export const PUZZLES: Record<'sorted' | 'rare', { name: string }> = { sorted: { name: 'Sorted' }, rare: { name: 'Rare Find' } };
export const gameName = (game: ArcadeGame) => game === 'sorted' || game === 'rare' ? PUZZLES[game].name : DUEL_GAMES[game].name;
export const isDuelGame = (game: ArcadeGame | null): game is DuelGame => !!game && game !== 'sorted' && game !== 'rare';

// A duel's game with the challenger's choices: "Typing race: a famous quote".
const TEXT_NAMES = { code: 'code', story: 'a story', quotes: 'a famous quote', words: 'common words' } as const;
export const duelTitle = (game: DuelGame, options?: DuelOptions) =>
  options?.text ? `${DUEL_GAMES[game].name}: ${TEXT_NAMES[options.text]}` : DUEL_GAMES[game].name;

// Who you could challenge, by name: "Gus is free", "Gus and Sam are free",
// "Gus, Sam and 3 others are free".
export function whoIsFree(names: string[]): string {
  if (names.length === 1) return `${names[0]} is free for a duel`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are free`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are free`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others are free`;
}
