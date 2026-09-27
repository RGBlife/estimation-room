import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeStats from './HomeStats.tsx';

const stats = {
  live: { online: 1, roomsInUse: 2, drivers: 0 },
  totals: { storedRooms: 14, roomsCreated: 20, votesCast: 4812, roundsRevealed: 611, ticketsRefined: 57, thingsThrown: 93, nudges: 4, gtaRides: 12, carsWrecked: 41, decks: { fibonacci: 15, tshirt: 5 } },
  since: Date.UTC(2026, 8, 27),
};

afterEach(() => vi.unstubAllGlobals());

describe('HomeStats', () => {
  it('shows live and all-time numbers, deck shares and ping', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('/api/stats') ? JSON.stringify(stats) : '{"status":"ok"}', { status: 200 })));
    render(<HomeStats />);
    expect(await screen.findByText('4,812')).toBeTruthy();
    expect(screen.getByText('person online')).toBeTruthy();
    expect(screen.getByText('rooms in use')).toBeTruthy();
    expect(screen.getByText('tickets refined')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText(/counting since 27 September 2026/)).toBeTruthy();
    expect(screen.getByText(/ms$/)).toBeTruthy();
  });

  it('says so when the stats cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    render(<HomeStats />);
    expect(await screen.findByText(/coffee break/)).toBeTruthy();
  });
});
