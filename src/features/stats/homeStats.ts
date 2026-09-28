import { apiBase } from '../../shared/lib/roomConnection.ts';
import { DECKS } from '../room/decks.ts';
import type { DeckId } from '../../types/room.ts';

// The room service's public, counts-only numbers (GET /api/stats).
export interface HomeStats {
  live: { online: number; roomsInUse: number; drivers: number };
  totals: {
    storedRooms: number;
    roomsCreated: number;
    votesCast: number;
    roundsRevealed: number;
    ticketsRefined: number;
    thingsThrown: number;
    nudges: number;
    gtaRides: number;
    carsWrecked: number;
    decks: Partial<Record<DeckId, number>>;
  };
  since: number;
}

export async function fetchHomeStats(signal?: AbortSignal): Promise<HomeStats> {
  const response = await fetch(`${apiBase()}/api/stats`, { signal });
  if (!response.ok) throw new Error(`Stats unavailable (${response.status})`);
  return response.json() as Promise<HomeStats>;
}

// Round trip to the room service from this browser: the best of a few tiny
// requests, so one slow first connection (DNS, TLS) doesn't count as lag.
export async function measurePing(samples = 3, signal?: AbortSignal): Promise<number> {
  let best = Infinity;
  for (let i = 0; i < samples; i++) {
    const started = performance.now();
    const response = await fetch(`${apiBase()}/health/live`, { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Ping failed');
    best = Math.min(best, performance.now() - started);
  }
  return Math.round(best);
}

const numberFormat = new Intl.NumberFormat('en-GB');
export const formatCount = (value: number) => numberFormat.format(value);

export const formatSince = (since: number) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(since));

export interface DeckShare { id: DeckId; name: string; count: number; share: number }

// Deck choices as shares of all rooms created, most popular first. Decks nobody
// has picked are left out rather than shown as empty bars.
export function deckShares(decks: HomeStats['totals']['decks']): DeckShare[] {
  const entries = Object.entries(decks).filter((entry): entry is [DeckId, number] => entry[0] in DECKS && (entry[1] ?? 0) > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return [];
  return entries
    .map(([id, count]) => ({ id, name: DECKS[id].name, count, share: count / total }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
