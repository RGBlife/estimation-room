import { describe, it, expect } from 'vitest';
import { deckShares, formatCount } from './homeStats.ts';

describe('deckShares', () => {
  it('turns deck counts into shares, most popular first, skipping unpicked and unknown decks', () => {
    const shares = deckShares({ fibonacci: 6, tshirt: 2, rom: 0, ...({ bogus: 5 } as object) });
    expect(shares.map(s => [s.id, s.share])).toEqual([['fibonacci', 0.75], ['tshirt', 0.25]]);
    expect(shares[0].name).toBe('Fibonacci');
  });

  it('is empty when no rooms have been created', () => {
    expect(deckShares({})).toEqual([]);
  });
});

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(4812)).toBe('4,812');
  });
});
