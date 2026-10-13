// Games in the Arcade. The room service runs them and keeps the answers;
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
export type Mark = 'X' | 'O';

export interface DuelSide {
  uid: string;
  // As it was when the challenge was made, so it reads well after they leave.
  name: string;
  // In the board games, once accepted: X moves first, O second.
  mark?: Mark;
}

export type DuelStatus = 'offered' | 'playing' | 'won' | 'drawn' | 'declined' | 'expired' | 'cancelled' | 'abandoned';

// Turn by turn: ultimate noughts and crosses, Connect Four, Battleship, dots
// and boxes, mancala. Both at once: Word Hunt, reaction, typing, maths, Pong,
// light cycles.
export type DuelGame = 'ultimate' | 'connect' | 'battleship' | 'dots' | 'mancala' | 'words' | 'reaction' | 'typing' | 'maths' | 'pong' | 'cycles';

// What a typing race types: code, a bit of a story, a famous quote or a run of common words.
export type TypingKind = 'code' | 'story' | 'quotes' | 'words';
// The challenger's choices for a game; only the typing race has any.
export interface DuelOptions { text?: TypingKind }

// One side's waters in Battleship: the other side's shots into them, the
// ships sunk there, and the fleet itself only for its owner (or for
// everyone once the duel is over).
export interface DuelSea {
  shots: { cell: number; hit: boolean }[];
  sunk: number[][];
  fleet?: number[][];
}

// A value for each side, by uid.
export type BySide<T> = Record<string, T>;

export interface DuelView {
  id: string;
  game: DuelGame;
  status: DuelStatus;
  // Coins each side puts in; the winner takes both.
  stake: number;
  challenger: DuelSide;
  opponent: DuelSide;
  // The next round has started; play resumes at the reveal.
  paused: boolean;
  // Time left when the service sent this, in milliseconds (browsers'
  // clocks disagree with the service's, so it never sends a deadline).
  offerLeftMs?: number;
  turnLeftMs?: number;
  // Turn games: whose move it is.
  turn?: string;
  winner?: string;
  // The squares (or small boards) that won.
  line?: number[];
  // line, sunk and played are games played to a win.
  reason?: 'line' | 'sunk' | 'played' | 'draw' | 'resigned' | 'timeout' | 'left';
  // Coins each side received when it ended, by uid: stake back, pot and pay.
  paid?: BySide<number>;
  options?: DuelOptions;

  // Ultimate noughts and crosses: 81 squares, board by board (square s of
  // board b is b * 9 + s), each small board's result, and the board the next
  // move must be in. Connect Four: 42 squares, row by row from the top.
  board?: (Mark | null)[];
  boards?: (Mark | 'D' | null)[];
  forced?: number;
  // The square, line or pit last played.
  last?: number;
  // Dots and boxes: the lines across then down, and the boxes, by who took them.
  edges?: (Mark | null)[];
  boxes?: (Mark | null)[];
  // Mancala: X's six pits and store, then O's.
  pits?: number[];
  // Battleship, once accepted: each side's waters, by uid.
  seas?: BySide<DuelSea>;
  lastShot?: { by: string; cell: number; hit: boolean; sunk: boolean };

  // Games both play at once: a countdown, then the game's own clock.
  startsInMs?: number;
  endsInMs?: number;
  limitMs?: number;
  // Word Hunt: the letters, the scores and how many words each has, and the
  // words themselves (your own while it's on; everyone's after).
  grid?: string[];
  scores?: BySide<number>;
  counts?: BySide<number>;
  words?: BySide<string[] | null>;
  // Typing race: the line to type, what kind it is (and who said it, for a
  // quote), how far each has got, and when each finished.
  text?: string;
  kind?: TypingKind;
  credit?: string;
  typed?: BySide<number>;
  finished?: BySide<number>;
  // Speed maths: the ten sums, and how many each has answered.
  sums?: string[];
  answered?: BySide<number>;
  // Reaction and light cycles: the round, where it stands, and rounds won.
  round?: number;
  phase?: 'ready' | 'wait' | 'go' | 'result' | 'riding';
  won?: BySide<number>;
  result?: { winner?: string; ms?: number; early?: string; void?: boolean };
  // Pong: the ball (along, across, and speed in each), the paddles across the
  // court, the points, and the time to the next serve.
  ball?: [number, number, number, number];
  paddles?: BySide<number>;
  points?: BySide<number>;
  serveInMs?: number;
  // Light cycles: steps ridden this round, each side's turns as [step,
  // direction], who crashed, and the countdown to the ride.
  steps?: number;
  turns?: BySide<[number, number][]>;
  crashed?: string[];
  rideInMs?: number;
}

// A move in a duel: a square, column, line or pit; a word traced through
// the grid; a typed line; an answer; or a tap in a reaction round.
export type DuelPlay = { cell: number } | { path: number[] } | { text: string } | { answer: number } | { round: number };

// Steering, many times a second: a paddle across the court (0 to 1, from
// your own end), a light cycle's direction (0 up, then clockwise), or how
// many characters you've typed right.
export type DuelSteer = { x: number } | { dir: number } | { typed: number };

// What moved since the last state, for a game in play: merged over it.
export type DuelFrame = Partial<DuelView> & { id: string };

export type DuelMove =
  | { operation: 'challenge'; game: DuelGame; opponent: string; stake: number; options?: DuelOptions }
  | { operation: 'accept' | 'decline' | 'cancel' | 'resign'; id: string }
  | ({ operation: 'move'; id: string } & DuelPlay);

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
