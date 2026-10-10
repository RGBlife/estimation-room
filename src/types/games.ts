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
