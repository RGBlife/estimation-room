import type { DuelMove, DuelView } from '../types/games.ts';

// Dev-only stand-in for the room service's duels, so challenges and the
// board can be seen and played in the network-free harness. The real rules
// live in the service (scrum-poker-backend Duels.cs). Whoever you challenge
// accepts after a moment and plays the first free square of a fixed order.
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const PREFERENCE = [4, 0, 2, 6, 8, 1, 3, 5, 7];
const REPLY_MS = 700;

export type FakeDuelSeed = 'incoming' | 'waiting' | 'playing' | 'won' | 'watch';

export function fakeDuels(me: string, nameOf: (uid: string) => string, seed: string | null, onChange: (duels: DuelView[]) => void, onCoins: (paid: number) => void) {
  const side = (uid: string, mark?: 'X' | 'O') => ({ uid, name: nameOf(uid), ...(mark ? { mark } : {}) });
  const base = { game: 'noughts' as const, paused: false, board: Array<'X' | 'O' | null>(9).fill(null) };
  let duels: DuelView[] = [];
  let next = 1;
  switch (seed as FakeDuelSeed) {
    case 'incoming': duels = [{ ...base, id: 'd0', status: 'offered', stake: 20, challenger: side('p1'), opponent: side(me), offerLeftMs: 45_000 }]; break;
    case 'waiting': duels = [{ ...base, id: 'd0', status: 'offered', stake: 10, challenger: side(me), opponent: side('p1'), offerLeftMs: 52_000 }]; break;
    case 'playing': duels = [{ ...base, id: 'd0', status: 'playing', stake: 20, challenger: side(me, 'X'), opponent: side('p1', 'O'), board: ['X', null, null, null, 'O', null, null, null, null], turn: me, turnLeftMs: 42_000 }]; break;
    case 'won': duels = [{ ...base, id: 'd0', status: 'won', stake: 20, challenger: side(me, 'X'), opponent: side('p1', 'O'), board: ['X', 'O', null, 'O', 'X', null, null, null, 'X'], winner: me, line: [0, 4, 8], reason: 'line', paid: { [me]: 55, p1: 5 } }]; break;
    case 'watch': duels = [{ ...base, id: 'd0', status: 'playing', stake: 0, challenger: side('p2', 'O'), opponent: side('p3', 'X'), board: [null, 'X', null, null, 'O', null, null, 'X', null], turn: 'p2', turnLeftMs: 38_000 }]; break;
  }
  const publish = () => onChange(duels);
  const update = (id: string, change: (duel: DuelView) => DuelView) => { duels = duels.map(d => d.id === id ? change(d) : d); publish(); };
  const find = (id: string) => {
    const duel = duels.find(d => d.id === id);
    if (!duel) throw new Error('This duel has ended');
    return duel;
  };
  const place = (duel: DuelView, uid: string, cell: number): DuelView => {
    const mark = duel.challenger.uid === uid ? duel.challenger.mark! : duel.opponent.mark!;
    const board = duel.board.map((c, i) => i === cell ? mark : c);
    const line = LINES.find(l => l.every(i => board[i] === mark));
    const other = duel.challenger.uid === uid ? duel.opponent.uid : duel.challenger.uid;
    if (line) {
      const paid = { [uid]: duel.stake * 2 + 15, [other]: 5 };
      if (paid[me]) onCoins(paid[me]);
      return { ...duel, board, status: 'won', winner: uid, line, reason: 'line', paid, turn: undefined, turnLeftMs: undefined };
    }
    if (board.every(c => c !== null)) {
      if (duel.challenger.uid === me || duel.opponent.uid === me) onCoins(duel.stake + 8);
      return { ...duel, board, status: 'drawn', reason: 'draw', paid: { [uid]: duel.stake + 8, [other]: duel.stake + 8 }, turn: undefined, turnLeftMs: undefined };
    }
    return { ...duel, board, turn: other, turnLeftMs: 60_000 };
  };
  const reply = (id: string) => setTimeout(() => {
    const duel = duels.find(d => d.id === id);
    if (!duel || duel.status !== 'playing' || duel.turn === me) return;
    update(id, d => place(d, d.turn!, PREFERENCE.find(i => d.board[i] === null)!));
  }, REPLY_MS);

  const duel = async (move: DuelMove) => {
    switch (move.operation) {
      case 'challenge': {
        const id = `d${next++}`;
        duels = [...duels.filter(d => d.status === 'offered' || d.status === 'playing'), { ...base, id, status: 'offered', stake: move.stake, challenger: side(me), opponent: side(move.opponent), offerLeftMs: 60_000 }];
        publish();
        setTimeout(() => {
          if (duels.find(d => d.id === id)?.status !== 'offered') return;
          update(id, d => ({ ...d, status: 'playing', offerLeftMs: undefined, challenger: { ...d.challenger, mark: 'O' }, opponent: { ...d.opponent, mark: 'X' }, turn: d.opponent.uid, turnLeftMs: 60_000 }));
          reply(id);
        }, 1500);
        break;
      }
      case 'accept': update(move.id, d => ({ ...d, status: 'playing', offerLeftMs: undefined, challenger: { ...d.challenger, mark: 'X' }, opponent: { ...d.opponent, mark: 'O' }, turn: d.challenger.uid, turnLeftMs: 60_000 })); reply(move.id); break;
      case 'decline': update(move.id, d => ({ ...d, status: 'declined', offerLeftMs: undefined })); break;
      case 'cancel': update(move.id, d => ({ ...d, status: 'cancelled', offerLeftMs: undefined })); break;
      case 'resign': update(move.id, d => ({ ...d, status: 'won', reason: 'resigned', winner: d.challenger.uid === me ? d.opponent.uid : d.challenger.uid, turn: undefined, turnLeftMs: undefined })); break;
      case 'move': {
        const current = find(move.id);
        if (current.turn !== me || current.board[move.cell] !== null) throw new Error("It's not your turn");
        update(move.id, d => place(d, me, move.cell));
        reply(move.id);
        break;
      }
    }
  };
  return { initial: duels, duel };
}
