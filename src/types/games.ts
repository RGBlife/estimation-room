// Games in the Toolbox. The room service runs them and keeps the answers;
// the page only ever sees a player's own board.

export interface SortedGroup {
  name: string;
  // 0 is the most straightforward, 3 the trickiest.
  level: 0 | 1 | 2 | 3;
  items: string[];
}

// A Sorted board as the service sends it.
export interface SortedView {
  id: string;
  // Its place in the puzzle bank, for "Sorted #4".
  number: number;
  // Tiles not yet in a found group, in the service's shuffled order.
  tiles: string[];
  found: SortedGroup[];
  lives: number;
  finished: boolean;
  won: boolean;
  // Every puzzle has been played, so this one pays nothing.
  replay: boolean;
  // Once finished: the coins it paid, which today's limit may have reduced.
  paid?: number;
  // Once lost: the groups that weren't found.
  missed?: SortedGroup[];
  // How the guess that produced this board went.
  result?: 'correct' | 'wrong' | 'one-away' | 'repeat';
}

export type SortedMove = { operation: 'open' | 'next' } | { operation: 'guess'; items: string[] };

// A duel between two people at the table, as the service shows it to the
// whole room: anyone can watch. Coins held and paid are the players' own.
export interface DuelSide {
  uid: string;
  // As it was when the challenge was made, so it reads well after they leave.
  name: string;
  // Once accepted: who plays X (and moves first) and who plays O.
  mark?: 'X' | 'O';
}

export type DuelStatus = 'offered' | 'playing' | 'won' | 'drawn' | 'declined' | 'expired' | 'cancelled' | 'abandoned';

export interface DuelView {
  id: string;
  game: 'noughts';
  status: DuelStatus;
  // Coins each side puts in; the winner takes both.
  stake: number;
  challenger: DuelSide;
  opponent: DuelSide;
  // Nine squares, row by row.
  board: ('X' | 'O' | null)[];
  // The next round has started; play resumes at the reveal.
  paused: boolean;
  // Time left when the service sent this, in milliseconds (browsers'
  // clocks disagree with the service's, so it never sends a deadline).
  offerLeftMs?: number;
  turnLeftMs?: number;
  turn?: string;
  winner?: string;
  // The three squares that won.
  line?: number[];
  reason?: 'line' | 'draw' | 'resigned' | 'timeout' | 'left';
  // Coins each side received when it ended, by uid: stake back, pot and pay.
  paid?: Record<string, number>;
}

export type DuelMove =
  | { operation: 'challenge'; opponent: string; stake: number }
  | { operation: 'accept' | 'decline' | 'cancel' | 'resign'; id: string }
  | { operation: 'move'; id: string; cell: number };

export interface RareAnswerCount {
  answer: string;
  count: number;
}

// A Rare Find question as the service sends it; the counts once answered.
export interface RareView {
  category: string;
  number: number;
  // "Name a fruit".
  prompt: string;
  // Every question has been answered, so this one pays nothing.
  replay: boolean;
  // Before answering: how many people have been asked.
  asked?: number;
  // Once answered: yours as typed, the norms' spelling it matched, how many
  // others gave it out of how many asked, and what it paid.
  answer?: string;
  match?: string;
  count?: number;
  total?: number;
  paid?: number;
  // Someone else has given it too, so it counts.
  valid?: boolean;
  // From the category norms only; other players' answers are never shown.
  common?: RareAnswerCount[];
  rarest?: RareAnswerCount[];
}

export type RareMove = { operation: 'open' | 'next' } | { operation: 'answer'; answer: string };
