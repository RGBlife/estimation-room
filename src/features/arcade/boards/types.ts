import type { DuelPlay, DuelSteer, DuelView } from '../../../types/games.ts';

// What every game's board is given, whether it's a duel at the table, a
// game against the computer, or someone else's duel being watched.
export interface BoardProps {
  // The duel as it stands, with any frame since its last state merged in.
  duel: DuelView;
  uid: string | null;
  // You're one of the two playing (not watching).
  player: boolean;
  // You can move now: the game is on, not paused, and in a turn game, it's your turn.
  playable: boolean;
  // A move; rejects with the rule it broke ("Not in the word list").
  onMove: (play: DuelPlay) => Promise<void>;
  // Steering, many times a second; nothing comes back.
  onSteer: (input: DuelSteer) => void;
  // Games played both at once: the countdown to the start and the time
  // left, counting down on this screen.
  clock: { startsIn?: number; endsIn?: number };
}

// The two sides from where you sit: you first, when you're playing.
export function sidesOf(duel: DuelView, uid: string | null) {
  const mine = duel.opponent.uid === uid;
  const near = mine ? duel.opponent : duel.challenger;
  const far = mine ? duel.challenger : duel.opponent;
  return { near, far, you: near.uid === uid };
}

// A side's colour in games without X and O: the challenger's is blue, the
// opponent's red, the same on every screen.
export const sideTone = (duel: DuelView, uid: string) => duel.challenger.uid === uid ? 'a' : 'b';

export const nameFor = (side: { uid: string; name: string }, uid: string | null) => side.uid === uid ? 'You' : side.name;
