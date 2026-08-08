import type { Participant, CardValue } from '../../types/room.ts';
import type { DeckDefinition } from './decks.ts';

export interface Stats {
  anyVote: boolean;
  allVoted: boolean;
  hasAverage: boolean;
  average: string | null;
  isWideSpread: boolean;
  mode: string | null;
  modeIsTie: boolean;
  flaggedCount: number;
}

export function computeStats(participants: Record<string, Participant>, deck: DeckDefinition): Stats {
  const active = Object.values(participants).filter((p) => !p.isObserver);
  const votes = active.filter((p) => p.vote != null).map((p) => p.vote as CardValue);
  const anyVote = votes.length > 0;
  const allVoted = active.length > 0 && votes.length === active.length;

  const numeric = votes.map(parseFloat).filter((n) => !isNaN(n));
  const hasAverage = numeric.length > 0;
  const average = hasAverage ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1) : null;
  const isWideSpread = numeric.length >= 2 && Math.max(...numeric) - Math.min(...numeric) >= 8;

  const flaggedCount = deck.flagValue != null ? votes.filter((v) => v === deck.flagValue).length : 0;

  const modeCounts: Partial<Record<CardValue, number>> = {};
  for (const v of votes) {
    if (deck.flagValue != null && v === deck.flagValue) continue;
    modeCounts[v] = (modeCounts[v] ?? 0) + 1;
  }
  const modeEntries = Object.entries(modeCounts);
  const maxModeCount = modeEntries.length > 0 ? Math.max(...modeEntries.map(([, c]) => c!)) : 0;
  const topModeValues = modeEntries.filter(([, c]) => c === maxModeCount).map(([v]) => v);
  const modeIsTie = topModeValues.length > 1;
  const mode = topModeValues.length > 0 ? (modeIsTie ? null : topModeValues[0]) : null;

  return { anyVote, allVoted, hasAverage, average, isWideSpread, mode, modeIsTie, flaggedCount };
}

export interface DistributionGroup {
  value: CardValue;
  count: number;
  isTop: boolean;
  voters: Participant[];
}

export function computeDistribution(participants: Record<string, Participant>, deck: DeckDefinition): DistributionGroup[] {
  const groups: Partial<Record<CardValue, Participant[]>> = {};
  Object.values(participants).forEach((p) => {
    if (!p.isObserver && p.vote != null) {
      (groups[p.vote] = groups[p.vote] || []).push(p);
    }
  });
  const maxCount = Math.max(1, ...Object.values(groups).map((g) => g!.length));
  const values = deck.values?.map((spec) => spec.value) ?? [];
  return values.filter((value) => groups[value]).map((value) => {
    const group = groups[value]!;
    return {
      value,
      count: group.length,
      isTop: group.length === maxCount,
      voters: group,
    };
  });
}

export interface CustomVoteGroup {
  key: string;
  display: string;
  count: number;
  isTop: boolean;
}

export function computeCustomGroups(participants: Record<string, Participant>): CustomVoteGroup[] {
  const groups: Record<string, { display: string; count: number }> = {};
  Object.values(participants).forEach((p) => {
    if (p.isObserver || p.vote == null) return;
    const key = p.vote.trim().toLowerCase();
    if (!groups[key]) groups[key] = { display: p.vote, count: 0 };
    groups[key].count += 1;
  });
  const maxCount = Math.max(0, ...Object.values(groups).map((g) => g.count));
  return Object.entries(groups)
    .map(([key, { display, count }]) => ({ key, display, count, isTop: count === maxCount }))
    .sort((a, b) => b.count - a.count);
}
