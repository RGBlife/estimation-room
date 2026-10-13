import { LocalDuel } from '../features/arcade/play/local.ts';
import { TICK_MS, type Side } from '../features/arcade/play/match.ts';
import { loadWordList } from '../features/arcade/play/wordList.ts';
import { pushFrame } from '../features/arcade/frames.ts';
import type { Battleship } from '../features/arcade/play/battleship.ts';
import type { DuelGame, DuelMove, DuelOptions, DuelSteer, DuelView } from '../types/games.ts';

// Dev-only stand-in for the room service's duels, so challenges and every
// game can be seen and played in the network-free harness. The games are
// played by the same rules as the service (play/), and whoever you
// challenge is the computer: it accepts after a moment and plays its side.
// At Battleship the fleets are fixed and it opens with a fixed run of shots
// (a miss, then a ship of yours sunk), so a visual test knows what lands.
const ACCEPT_MS = 1500;
const SEA_OPENING = [21, 3, 4, 5, 10];
const FLEETS = [
  [[0, 1, 2], [9, 15, 21], [24, 25], [34, 35]],
  [[7, 13, 19], [3, 4, 5], [27, 28], [30, 31]],
];
// The winning game of ultimate noughts and crosses, X's moves first.
const ULTIMATE_WIN = [56, 25, 66, 33, 62, 78, 59, 53, 73, 15, 69, 71, 76, 43, 63, 8, 79];

// incoming, waiting, playing, won and watch are ultimate noughts and
// crosses; play:<game> is any game in play against p1, your move first.
export type FakeDuelSeed = 'incoming' | 'waiting' | 'playing' | 'won' | 'watch' | 'battleship' | 'battleship-incoming' | `play:${DuelGame}` | `incoming:${DuelGame}`;

// Before it's accepted, a challenge is just its view; after, a game in play.
interface Entry { id: string; view?: DuelView; local?: LocalDuel; paid?: Record<string, number> }

export function fakeDuels(me: string, nameOf: (uid: string) => string, seed: string | null, onChange: (duels: DuelView[]) => void, onCoins: (paid: number) => void) {
  const side = (uid: string): Side => ({ uid, name: nameOf(uid) });
  let entries: Entry[] = [];
  let next = 1;
  let timer: ReturnType<typeof setInterval> | null = null;
  // While the seed's moves are made: nothing is announced, and nobody is paid.
  let seeding = true;
  // Once the page is on screen (see attach): until then nothing ticks or is
  // announced, as the page can't take an update before it has mounted.
  let attached = false;

  const views = () => entries.map(e => e.local ? { ...e.local.view(me), stake: e.local.match.stake, ...(e.paid ? { paid: e.paid } : {}) } : e.view!);
  const publish = () => onChange(views());
  // Pays out once a game ends: the pot to the winner, house coins to both.
  const settle = (entry: Entry) => {
    const match = entry.local!.match;
    if (entry.paid || match.live) return;
    const stake = match.stake;
    entry.paid = match.status === 'drawn'
      ? { [match.challenger.uid]: stake + 8, [match.opponent.uid]: stake + 8 }
      : match.reason === 'resigned' ? { [match.winner!]: stake * 2 }
      : { [match.winner!]: stake * 2 + 15, [match.other(match.winner!).uid]: 5 };
    if (entry.paid[me] && !seeding) onCoins(entry.paid[me]);
  };
  const run = () => {
    timer ??= setInterval(() => {
      for (const entry of entries) entry.local?.tick();
      if (!entries.some(e => e.local && !e.local.over)) { clearInterval(timer!); timer = null; }
    }, TICK_MS);
  };
  const play = (entry: Entry, game: DuelGame, challenger: Side, opponent: Side, first: 'challenger' | 'opponent', stake: number, options?: DuelOptions) => {
    const bot = challenger.uid === me ? opponent.uid : challenger.uid;
    entry.local = new LocalDuel(game, challenger, opponent, bot, {
      id: entry.id, first, stake, options, ...(game === 'battleship' ? { fleets: FLEETS, script: SEA_OPENING } : {}),
    });
    entry.view = undefined;
    entry.local.subscribe(frame => {
      if (frame) { pushFrame(frame); return; }
      settle(entry);
      if (!seeding && attached) publish();
    });
    if (attached) run();
  };
  const offer = (game: DuelGame, challenger: string, opponent: string, stake: number, offerLeftMs: number, options?: DuelOptions): Entry => {
    const id = `d${next++}`;
    return { id, view: { id, game, status: 'offered', stake, paused: false, challenger: side(challenger), opponent: side(opponent), offerLeftMs, ...(options ? { options } : {}) } };
  };
  const started = (game: DuelGame, challenger: string, opponent: string, stake: number, first: 'challenger' | 'opponent' = 'challenger') => {
    const entry: Entry = { id: `d${next++}` };
    play(entry, game, side(challenger), side(opponent), first, stake);
    return entry;
  };

  const [kind, game] = (seed ?? '').split(':') as [string, DuelGame | undefined];
  switch (kind) {
    case 'incoming': entries = [offer(game ?? 'ultimate', 'p1', me, 20, 45_000)]; break;
    case 'battleship-incoming': entries = [offer('battleship', 'p1', me, 10, 45_000)]; break;
    case 'waiting': entries = [offer('ultimate', me, 'p1', 10, 52_000)]; break;
    case 'playing': {
      const entry = started('ultimate', me, 'p1', 20);
      entry.local!.move(me, { cell: 40 }); entry.local!.move('p1', { cell: 36 });
      entries = [entry];
      break;
    }
    case 'won': {
      const entry = started('ultimate', me, 'p1', 20);
      ULTIMATE_WIN.forEach((cell, i) => entry.local!.move(i % 2 === 0 ? me : 'p1', { cell }));
      entries = [entry];
      break;
    }
    case 'watch': {
      const entry = started('ultimate', 'p3', 'p2', 0, 'challenger');
      entry.local!.move('p3', { cell: 40 }); entry.local!.move('p2', { cell: 37 });
      entries = [entry];
      break;
    }
    // Mid-game: you've hit one of theirs and missed twice; they've sunk one of yours.
    case 'battleship': {
      const entry = started('battleship', me, 'p1', 20);
      const sea = entry.local!.match.play as Battleship;
      sea.shots[me] = [7, 13, 14, 22]; sea.shots.p1 = [0, 1, 2, 6, 33];
      entries = [entry];
      break;
    }
    // Word Hunt's grid needs the word list: see attach.
    case 'play': if (game && game !== 'words') entries = [started(game, me, 'p1', 0)]; break;
  }
  seeding = false;

  const find = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) throw new Error('This duel has ended');
    return entry;
  };
  const duel = async (move: DuelMove) => {
    switch (move.operation) {
      case 'challenge': {
        // Word Hunt needs its word list before the grid can be rolled.
        if (move.game === 'words') await loadWordList();
        const entry = offer(move.game, me, move.opponent, move.stake, 60_000, move.options);
        entries = [...entries.filter(e => e.local ? !e.local.over : e.view!.status === 'offered'), entry];
        publish();
        setTimeout(() => {
          if (entry.view?.status !== 'offered') return;
          play(entry, move.game, side(me), side(move.opponent), 'opponent', move.stake, move.options);
          publish();
        }, ACCEPT_MS);
        break;
      }
      case 'accept': {
        const entry = find(move.id);
        if (entry.view?.game === 'words') await loadWordList();
        play(entry, entry.view!.game, entry.view!.challenger, entry.view!.opponent, 'challenger', entry.view!.stake, entry.view!.options);
        publish();
        break;
      }
      case 'decline': case 'cancel': {
        const entry = find(move.id);
        entry.view = { ...entry.view!, status: move.operation === 'decline' ? 'declined' : 'cancelled', offerLeftMs: undefined };
        publish();
        break;
      }
      case 'resign': find(move.id).local?.resign(me); break;
      case 'move': {
        const { operation: _, id, ...played } = move;
        void _;
        find(id).local!.move(me, played);
        break;
      }
    }
  };
  const steer = (id: string, input: DuelSteer) => entries.find(e => e.id === id)?.local?.steer(me, input);
  // Once the page is on screen: the seeded games start ticking, and anything
  // seeded that had to wait (Word Hunt's word list) arrives now.
  const attach = () => {
    if (attached) return;
    attached = true;
    if (entries.some(e => e.local && !e.local.over)) { run(); publish(); }
    if (kind === 'play' && game === 'words') void loadWordList().then(() => { entries = [started('words', me, 'p1', 0)]; publish(); });
  };
  return { initial: views(), duel, steer, attach };
}
