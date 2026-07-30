import { describe, it, expect } from 'vitest';
import { computeStats, computeDistribution } from './stats.js';

const p = (vote, isObserver = false) => ({ name: 'x', isObserver, vote, joinedAt: 0 });

describe('computeStats', () => {
  it('reports no votes for an empty room', () => {
    expect(computeStats({})).toEqual({ anyVote: false, allVoted: false, hasAverage: false, average: null, isWideSpread: false });
  });

  it('ignores observers and non-voters', () => {
    const stats = computeStats({ a: p('5'), b: p('8', true), c: p(null) });
    expect(stats.anyVote).toBe(true);
    expect(stats.average).toBe('5.0');
  });

  it('averages only numeric votes', () => {
    const stats = computeStats({ a: p('3'), b: p('5'), c: p('?'), d: p('☕') });
    expect(stats.hasAverage).toBe(true);
    expect(stats.average).toBe('4.0');
  });

  it('has no average when only non-numeric votes exist', () => {
    const stats = computeStats({ a: p('?'), b: p('☕') });
    expect(stats.anyVote).toBe(true);
    expect(stats.hasAverage).toBe(false);
    expect(stats.average).toBe(null);
  });

  it('flags a wide spread only for a gap of 8 or more across two or more numeric votes', () => {
    expect(computeStats({ a: p('1'), b: p('13') }).isWideSpread).toBe(true);
    expect(computeStats({ a: p('5'), b: p('8') }).isWideSpread).toBe(false);
    expect(computeStats({ a: p('20') }).isWideSpread).toBe(false);
  });

  it('flags allVoted only when every active participant has voted', () => {
    expect(computeStats({ a: p('5'), b: p(null) }).allVoted).toBe(false);
    expect(computeStats({ a: p('5'), b: p('8', true) }).allVoted).toBe(true);
    expect(computeStats({ a: p('5'), b: p('8') }).allVoted).toBe(true);
    expect(computeStats({}).allVoted).toBe(false);
  });
});

describe('computeDistribution', () => {
  it('groups votes by value, in CARD_VALUES order, marking the top group(s)', () => {
    const dist = computeDistribution({ a: p('5'), b: p('5'), c: p('3'), d: p(null), e: p('8', true) });
    expect(dist).toEqual([
      { value: '3', count: 1, isTop: false, voters: [p('3')] },
      { value: '5', count: 2, isTop: true, voters: [p('5'), p('5')] },
    ]);
  });

  it('sorts non-numeric values after numeric ones', () => {
    const dist = computeDistribution({ a: p('?'), b: p('2') });
    expect(dist.map(d => d.value)).toEqual(['2', '?']);
  });
});
