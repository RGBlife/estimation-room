import type { SortedGroup, SortedMove, SortedView } from '../types/games.ts';

// Dev-only stand-in for the room service's Sorted, so the board can be seen
// and played in the network-free harness. The real rules live in the
// service (scrum-poker-backend Sorted.cs); this follows them closely enough
// to look right, with two fixture puzzles and a fixed tile order.
const PUZZLES: SortedGroup[][] = [
  [
    { name: 'Scrum events', level: 0, items: ['STANDUP', 'RETRO', 'REVIEW', 'PLANNING'] },
    { name: 'Fibonacci numbers', level: 1, items: ['FIVE', 'EIGHT', 'THIRTEEN', 'TWENTY-ONE'] },
    { name: '___board', level: 2, items: ['SURF', 'CHESS', 'DART', 'KEY'] },
    { name: 'Hidden animals', level: 3, items: ['SCATTER', 'BEARD', 'PLANTED', 'BRAT'] },
  ],
  [
    { name: 'Biscuits', level: 0, items: ['HOBNOB', 'BOURBON', 'CUSTARD CREAM', 'DIGESTIVE'] },
    { name: 'Tube lines', level: 1, items: ['JUBILEE', 'VICTORIA', 'CENTRAL', 'DISTRICT'] },
    { name: 'Monopoly squares', level: 2, items: ['MAYFAIR', 'PARK LANE', 'STRAND', 'PICCADILLY'] },
    { name: '___ pudding', level: 3, items: ['BREAD', 'RICE', 'YORKSHIRE', 'BLACK'] },
  ],
];
const ORDER = [5, 0, 14, 9, 2, 12, 7, 3, 10, 15, 1, 8, 13, 4, 11, 6];

export function fakeSorted(onCoins: (paid: number) => void, foundAtStart = 0) {
  let puzzle = 0;
  let found: number[] = Array.from({ length: foundAtStart }, (_, i) => i);
  let lives = 3;
  let finished = false;
  let paid = 0;
  const wrong = new Set<string>();
  const view = (result?: SortedView['result']): SortedView => {
    const groups = PUZZLES[puzzle];
    const all = ORDER.map(i => groups[Math.floor(i / 4)].items[i % 4]);
    const taken = new Set(found.flatMap(g => groups[g].items));
    const won = found.length === 4;
    return {
      id: `fake${puzzle}`, number: puzzle + 1, tiles: all.filter(t => !taken.has(t)), found: found.map(g => groups[g]), lives,
      finished, won, replay: false, result,
      ...(finished ? { paid, ...(won ? {} : { missed: groups.filter((_, g) => !found.includes(g)) }) } : {}),
    };
  };
  return async (move: SortedMove): Promise<SortedView> => {
    await new Promise(resolve => setTimeout(resolve, 120));
    if (move.operation === 'open') return view();
    if (move.operation === 'next') {
      puzzle = (puzzle + 1) % PUZZLES.length; found = []; lives = 3; finished = false; paid = 0; wrong.clear();
      return view();
    }
    if (move.operation !== 'guess') return view();
    const key = [...move.items].sort().join('|');
    if (wrong.has(key)) return view('repeat');
    const groups = PUZZLES[puzzle];
    const match = groups.findIndex(g => g.items.every(t => move.items.includes(t)));
    if (match >= 0) {
      found = [...found, match];
      if (found.length === 4) { finished = true; paid = 10 + 5 * lives; onCoins(paid); }
      return view('correct');
    }
    wrong.add(key); lives -= 1;
    if (lives === 0) { finished = true; paid = 3; onCoins(paid); }
    return view(groups.some(g => g.items.filter(t => move.items.includes(t)).length === 3) ? 'one-away' : 'wrong');
  };
}
