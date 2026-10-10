import { useEffect, useState } from 'react';
import type { DuelGame, DuelSide, DuelView } from '../../types/games.ts';

// Reading the room's duels from one person's seat. The service decides
// everything; these only say where things stand, in words.

// How long a challenge stays open; matches Duels.OfferMs in the room service.
export const OFFER_MS = 60_000;

export const DUEL_GAMES: Record<DuelGame, { name: string; rules: string }> = {
  noughts: { name: 'Noughts and crosses', rules: 'Three in a row wins. Crosses go first.' },
  battleship: { name: 'Battleship', rules: 'Sink all four of their ships first. A hit earns another shot.' },
};

export const isLive = (duel: DuelView) => duel.status === 'offered' || duel.status === 'playing';
export const involves = (duel: DuelView, uid: string | null) => duel.challenger.uid === uid || duel.opponent.uid === uid;
export const isBusy = (duels: DuelView[], uid: string) => duels.some(d => isLive(d) && involves(d, uid));

// The duel this person is in: a live one, or else the last one that ended this round.
export function ownDuel(duels: DuelView[], uid: string | null): DuelView | null {
  const mine = duels.filter(d => involves(d, uid));
  return mine.find(isLive) ?? mine.at(-1) ?? null;
}

// A challenge waiting for this person's answer.
export const incomingChallenge = (duels: DuelView[], uid: string | null) =>
  duels.find(d => d.status === 'offered' && d.opponent.uid === uid) ?? null;

export const isMyMove = (duel: DuelView | null, uid: string | null) =>
  !!duel && duel.status === 'playing' && !duel.paused && duel.turn === uid;

const sideOf = (duel: DuelView, uid: string | undefined): DuelSide | undefined =>
  duel.challenger.uid === uid ? duel.challenger : duel.opponent.uid === uid ? duel.opponent : undefined;

// One line on where a duel stands, from `uid`'s seat (a watcher when not one of the two).
export function duelSummary(duel: DuelView, uid: string | null): { text: string; outcome?: 'won' | 'lost' | 'drawn' } {
  const me = sideOf(duel, uid ?? undefined);
  const them = me && (me === duel.challenger ? duel.opponent : duel.challenger);
  const winner = sideOf(duel, duel.winner);
  const loser = winner && (winner === duel.challenger ? duel.opponent : duel.challenger);
  switch (duel.status) {
    case 'offered':
      if (me === duel.challenger) return { text: `Waiting for ${duel.opponent.name} to accept` };
      if (me) return { text: `${duel.challenger.name} challenges you` };
      return { text: `${duel.challenger.name} challenged ${duel.opponent.name}` };
    case 'playing':
      if (duel.paused) return { text: 'Paused until the next reveal' };
      if (duel.turn === uid) return { text: 'Your move' };
      return { text: `${sideOf(duel, duel.turn)?.name ?? 'Their'}'s move` };
    case 'won': {
      const how = { line: '', sunk: '', draw: '', resigned: ' resigned', timeout: ' ran out of time', left: ' left the game' }[duel.reason ?? 'line'];
      if (!winner || !loser) return { text: 'Game over' };
      if (me === winner) return { text: how ? `${loser.name}${how}. You win` : 'You won', outcome: 'won' };
      if (me) return { text: how ? `You${how}` : `${winner.name} won`, outcome: 'lost' };
      return { text: how ? `${loser.name}${how}. ${winner.name} wins` : `${winner.name} won` };
    }
    case 'drawn': return { text: "It's a draw", outcome: me ? 'drawn' : undefined };
    case 'declined': return { text: me === duel.challenger ? `${them?.name} declined` : 'Challenge declined' };
    case 'expired': return { text: 'The challenge ran out of time' };
    case 'cancelled': return { text: 'Challenge withdrawn' };
    case 'abandoned': return { text: 'Abandoned. Stakes returned' };
  }
}

// Battleship: where the last shot landed, from `uid`'s seat.
export function shotSummary(duel: DuelView, uid: string | null): string | null {
  const shot = duel.lastShot;
  if (!shot) return null;
  const mine = shot.by === uid;
  const who = mine ? 'You' : sideOf(duel, shot.by)?.name ?? 'They';
  const outcome = shot.sunk ? 'sank a ship' : shot.hit ? 'hit' : 'missed';
  return `${who} ${outcome}${shot.hit && mine ? '. Fire again' : ''}.`;
}

// Counts down from the time left the service last sent, on this browser's own clock.
export function useCountdown(leftMs: number | undefined, sentWith: unknown): number | undefined {
  const [left, setLeft] = useState(leftMs);
  useEffect(() => {
    if (leftMs === undefined) { setLeft(undefined); return; }
    const end = performance.now() + leftMs;
    const tick = () => setLeft(Math.max(0, end - performance.now()));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [leftMs, sentWith]);
  return left;
}

export function formatSeconds(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
