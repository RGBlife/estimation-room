import type { DuelGame, DuelMove, DuelSea, DuelView } from '../types/games.ts';

// Dev-only stand-in for the room service's duels, so challenges and boards
// can be seen and played in the network-free harness. The real rules live
// in the service (scrum-poker-backend Duels.cs). Whoever you challenge
// accepts after a moment; at noughts and crosses they play the first free
// square of a fixed order, at Battleship they fire down the sea in order.
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const PREFERENCE = [4, 0, 2, 6, 8, 1, 3, 5, 7];
const REPLY_MS = 700;
// Fixed fleets, so a visual test knows where to aim.
const FLEETS = [
  [[0, 1, 2], [9, 15, 21], [24, 25], [34, 35]],
  [[7, 13, 19], [3, 4, 5], [27, 28], [30, 31]],
];

export type FakeDuelSeed = 'incoming' | 'waiting' | 'playing' | 'won' | 'watch' | 'battleship' | 'battleship-incoming';

// The service's own record of a duel: the view plus what it hides.
interface Hidden { view: DuelView; fleets: Record<string, number[][]>; shots: Record<string, number[]> }

export function fakeDuels(me: string, nameOf: (uid: string) => string, seed: string | null, onChange: (duels: DuelView[]) => void, onCoins: (paid: number) => void) {
  const side = (uid: string, mark?: 'X' | 'O') => ({ uid, name: nameOf(uid), ...(mark ? { mark } : {}) });
  const base = (game: DuelGame) => ({ game, paused: false, ...(game === 'noughts' ? { board: Array<'X' | 'O' | null>(9).fill(null) } : {}) });
  const hidden = (view: DuelView, shots: Record<string, number[]> = {}): Hidden => ({
    view, fleets: { [view.challenger.uid]: FLEETS[0], [view.opponent.uid]: FLEETS[1] }, shots: { [view.challenger.uid]: [], [view.opponent.uid]: [], ...shots },
  });
  let duels: Hidden[] = [];
  let next = 1;
  switch (seed as FakeDuelSeed) {
    case 'incoming': duels = [hidden({ ...base('noughts'), id: 'd0', status: 'offered', stake: 20, challenger: side('p1'), opponent: side(me), offerLeftMs: 45_000 })]; break;
    case 'battleship-incoming': duels = [hidden({ ...base('battleship'), id: 'd0', status: 'offered', stake: 10, challenger: side('p1'), opponent: side(me), offerLeftMs: 45_000 })]; break;
    case 'waiting': duels = [hidden({ ...base('noughts'), id: 'd0', status: 'offered', stake: 10, challenger: side(me), opponent: side('p1'), offerLeftMs: 52_000 })]; break;
    case 'playing': duels = [hidden({ ...base('noughts'), id: 'd0', status: 'playing', stake: 20, challenger: side(me, 'X'), opponent: side('p1', 'O'), board: ['X', null, null, null, 'O', null, null, null, null], turn: me, turnLeftMs: 42_000 })]; break;
    case 'won': duels = [hidden({ ...base('noughts'), id: 'd0', status: 'won', stake: 20, challenger: side(me, 'X'), opponent: side('p1', 'O'), board: ['X', 'O', null, 'O', 'X', null, null, null, 'X'], winner: me, line: [0, 4, 8], reason: 'line', paid: { [me]: 55, p1: 5 } })]; break;
    case 'watch': duels = [hidden({ ...base('noughts'), id: 'd0', status: 'playing', stake: 0, challenger: side('p2', 'O'), opponent: side('p3', 'X'), board: [null, 'X', null, null, 'O', null, null, null, 'X'], turn: 'p2', turnLeftMs: 38_000 })]; break;
    // Mid-game: you've hit one of theirs and missed twice; they've sunk one of yours.
    case 'battleship': duels = [hidden({ ...base('battleship'), id: 'd0', status: 'playing', stake: 20, challenger: side(me), opponent: side('p1'), turn: me, turnLeftMs: 41_000 },
      { [me]: [7, 13, 14, 22], p1: [0, 1, 2, 6, 33] })]; break;
  }

  const sea = (d: Hidden, owner: string): DuelSea => {
    const shooter = owner === d.view.challenger.uid ? d.view.opponent.uid : d.view.challenger.uid;
    const shots = d.shots[shooter];
    const fleet = d.fleets[owner];
    const over = d.view.status !== 'offered' && d.view.status !== 'playing';
    return {
      shots: shots.map(cell => ({ cell, hit: fleet.some(s => s.includes(cell)) })),
      sunk: fleet.filter(s => s.every(c => shots.includes(c))),
      ...(owner === me || over ? { fleet } : {}),
    };
  };
  const views = () => duels.map(d => d.view.game === 'battleship' && d.view.status !== 'offered'
    ? { ...d.view, seas: { [d.view.challenger.uid]: sea(d, d.view.challenger.uid), [d.view.opponent.uid]: sea(d, d.view.opponent.uid) } }
    : d.view);
  const publish = () => onChange(views());
  const find = (id: string) => {
    const duel = duels.find(d => d.view.id === id);
    if (!duel) throw new Error('This duel has ended');
    return duel;
  };
  const update = (id: string, change: (view: DuelView) => DuelView) => { const d = find(id); d.view = change(d.view); publish(); };
  const other = (d: DuelView, uid: string) => d.challenger.uid === uid ? d.opponent.uid : d.challenger.uid;
  const win = (d: DuelView, uid: string, extra: Partial<DuelView>): DuelView => {
    const paid = { [uid]: d.stake * 2 + 15, [other(d, uid)]: 5 };
    if (paid[me]) onCoins(paid[me]);
    return { ...d, ...extra, status: 'won', winner: uid, paid, turn: undefined, turnLeftMs: undefined };
  };

  const place = (d: DuelView, uid: string, cell: number): DuelView => {
    const mark = d.challenger.uid === uid ? d.challenger.mark! : d.opponent.mark!;
    const board = d.board!.map((c, i) => i === cell ? mark : c);
    const line = LINES.find(l => l.every(i => board[i] === mark));
    if (line) return win(d, uid, { board, line, reason: 'line' });
    if (board.every(c => c !== null)) {
      onCoins(d.stake + 8);
      return { ...d, board, status: 'drawn', reason: 'draw', paid: { [uid]: d.stake + 8, [other(d, uid)]: d.stake + 8 }, turn: undefined, turnLeftMs: undefined };
    }
    return { ...d, board, turn: other(d, uid), turnLeftMs: 60_000 };
  };
  const fire = (h: Hidden, uid: string, cell: number): DuelView => {
    const d = h.view;
    h.shots[uid] = [...h.shots[uid], cell];
    const fleet = h.fleets[other(d, uid)];
    const ship = fleet.find(s => s.includes(cell));
    const lastShot = { by: uid, cell, hit: !!ship, sunk: !!ship && ship.every(c => h.shots[uid].includes(c)) };
    if (fleet.every(s => s.every(c => h.shots[uid].includes(c)))) return win(d, uid, { lastShot, reason: 'sunk' });
    return { ...d, lastShot, turn: ship ? uid : other(d, uid), turnLeftMs: 60_000 };
  };
  const reply = (id: string) => setTimeout(() => {
    const h = duels.find(d => d.view.id === id);
    if (!h || h.view.status !== 'playing' || h.view.turn === me) return;
    const them = h.view.turn!;
    if (h.view.game === 'noughts') update(id, d => place(d, them, PREFERENCE.find(i => d.board![i] === null)!));
    else {
      const cell = Array.from({ length: 36 }, (_, i) => i).find(i => !h.shots[them].includes(i))!;
      update(id, () => fire(h, them, cell));
      reply(id);
    }
  }, REPLY_MS);
  const start = (d: DuelView, first: string): DuelView => ({
    ...d, status: 'playing', offerLeftMs: undefined, turn: first, turnLeftMs: 60_000,
    ...(d.game === 'noughts' ? {
      challenger: { ...d.challenger, mark: d.challenger.uid === first ? 'X' : 'O' },
      opponent: { ...d.opponent, mark: d.opponent.uid === first ? 'X' : 'O' },
    } : {}),
  });

  const duel = async (move: DuelMove) => {
    switch (move.operation) {
      case 'challenge': {
        const id = `d${next++}`;
        duels = [...duels.filter(d => d.view.status === 'offered' || d.view.status === 'playing'),
          hidden({ ...base(move.game), id, status: 'offered', stake: move.stake, challenger: side(me), opponent: side(move.opponent), offerLeftMs: 60_000 })];
        publish();
        setTimeout(() => {
          if (duels.find(d => d.view.id === id)?.view.status !== 'offered') return;
          update(id, d => start(d, d.opponent.uid));
          reply(id);
        }, 1500);
        break;
      }
      case 'accept': update(move.id, d => start(d, d.challenger.uid)); reply(move.id); break;
      case 'decline': update(move.id, d => ({ ...d, status: 'declined', offerLeftMs: undefined })); break;
      case 'cancel': update(move.id, d => ({ ...d, status: 'cancelled', offerLeftMs: undefined })); break;
      case 'resign': update(move.id, d => ({ ...d, status: 'won', reason: 'resigned', winner: other(d, me), turn: undefined, turnLeftMs: undefined })); break;
      case 'move': {
        const h = find(move.id);
        if (h.view.turn !== me) throw new Error("It's not your turn");
        if (h.view.game === 'noughts') {
          if (h.view.board![move.cell] !== null) throw new Error('Choose an empty square');
          update(move.id, d => place(d, me, move.cell));
        } else {
          if (h.shots[me].includes(move.cell)) throw new Error("You've already fired there");
          update(move.id, () => fire(h, me, move.cell));
        }
        reply(move.id);
        break;
      }
    }
  };
  return { initial: views(), duel };
}
