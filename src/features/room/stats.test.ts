import { describe, it, expect } from 'vitest';
import { computeStats, computeDistribution, computeCustomGroups } from './stats.ts';
import { DECKS } from './decks.ts';
import type { Participant } from '../../types/room.ts';

function participant(vote: string | null, overrides: Partial<Participant> = {}): Participant {
  return {
    name: 'P',
    isObserver: false,
    vote,
    joinedAt: 0,
    ...overrides,
  };
}

function byId(participants: Participant[]): Record<string, Participant> {
  return Object.fromEntries(participants.map((p, i) => [`u${i}`, p]));
}

describe('computeStats', () => {
  it('computes a numeric average for the fibonacci deck', () => {
    const participants = byId([participant('3'), participant('5'), participant('8')]);
    const stats = computeStats(participants, DECKS.fibonacci);
    expect(stats.anyVote).toBe(true);
    expect(stats.allVoted).toBe(true);
    expect(stats.hasAverage).toBe(true);
    expect(stats.average).toBe('5.3');
  });

  it('flags a wide spread when the numeric range is large', () => {
    const participants = byId([participant('1'), participant('21')]);
    const stats = computeStats(participants, DECKS.fibonacci);
    expect(stats.isWideSpread).toBe(true);
  });

  it('ignores observers and excludes them from allVoted', () => {
    const participants = byId([
      participant('5'),
      participant(null, { isObserver: true }),
    ]);
    const stats = computeStats(participants, DECKS.fibonacci);
    expect(stats.allVoted).toBe(true);
    expect(stats.anyVote).toBe(true);
  });

  it('has no average for a non-numeric deck like T-shirt, and computes mode instead', () => {
    const participants = byId([participant('M'), participant('M'), participant('L')]);
    const stats = computeStats(participants, DECKS.tshirt);
    expect(stats.hasAverage).toBe(false);
    expect(stats.average).toBeNull();
    expect(stats.mode).toBe('M');
    expect(stats.modeIsTie).toBe(false);
  });

  it('reports a tie when two values share the top count', () => {
    const participants = byId([participant('S'), participant('L')]);
    const stats = computeStats(participants, DECKS.tshirt);
    expect(stats.modeIsTie).toBe(true);
    expect(stats.mode).toBeNull();
  });

  it('counts ROM flagValue votes separately and excludes them from mode', () => {
    const participants = byId([
      participant('Needs breaking down'),
      participant('Needs breaking down'),
      participant('2'),
    ]);
    const stats = computeStats(participants, DECKS.rom);
    expect(stats.flaggedCount).toBe(2);
    expect(stats.mode).toBe('2');
  });

  it('flaggedCount is 0 for decks without a flagValue', () => {
    const participants = byId([participant('5')]);
    const stats = computeStats(participants, DECKS.fibonacci);
    expect(stats.flaggedCount).toBe(0);
  });
});

describe('computeDistribution', () => {
  it('groups votes by value in deck order and marks the top group', () => {
    const participants = byId([participant('5'), participant('5'), participant('3')]);
    const dist = computeDistribution(participants, DECKS.fibonacci);
    expect(dist.map((g) => g.value)).toEqual(['3', '5']);
    const five = dist.find((g) => g.value === '5')!;
    const three = dist.find((g) => g.value === '3')!;
    expect(five.count).toBe(2);
    expect(five.isTop).toBe(true);
    expect(three.isTop).toBe(false);
  });

  it('excludes unvoted values and observers', () => {
    const participants = byId([participant('8'), participant(null, { isObserver: true })]);
    const dist = computeDistribution(participants, DECKS.fibonacci);
    expect(dist).toHaveLength(1);
    expect(dist[0].value).toBe('8');
  });

  it('never marks the ROM flagValue as top, even when it ties or outnumbers the leading estimate', () => {
    const tied = computeDistribution(
      byId([participant('8'), participant('Needs breaking down')]),
      DECKS.rom,
    );
    expect(tied.find((g) => g.value === '8')!.isTop).toBe(true);
    expect(tied.find((g) => g.value === 'Needs breaking down')!.isTop).toBe(false);

    const outnumbered = computeDistribution(
      byId([
        participant('8'),
        participant('Needs breaking down'),
        participant('Needs breaking down'),
      ]),
      DECKS.rom,
    );
    expect(outnumbered.find((g) => g.value === '8')!.isTop).toBe(true);
    expect(outnumbered.find((g) => g.value === 'Needs breaking down')!.isTop).toBe(false);
  });
});

describe('computeCustomGroups', () => {
  it('groups case/whitespace-insensitively and keeps first-seen display casing', () => {
    const participants = byId([
      participant('2 weeks'),
      participant('2 Weeks'),
      participant(' 2 weeks '),
      participant('depends on API'),
    ]);
    const groups = computeCustomGroups(participants);
    const weeksGroup = groups.find((g) => g.key === '2 weeks')!;
    expect(weeksGroup.count).toBe(3);
    expect(weeksGroup.display).toBe('2 weeks');
    expect(weeksGroup.isTop).toBe(true);

    const apiGroup = groups.find((g) => g.key === 'depends on api')!;
    expect(apiGroup.count).toBe(1);
    expect(apiGroup.isTop).toBe(false);
  });

  it('sorts groups by count descending', () => {
    const participants = byId([participant('a'), participant('b'), participant('b')]);
    const groups = computeCustomGroups(participants);
    expect(groups.map((g) => g.key)).toEqual(['b', 'a']);
  });
});
