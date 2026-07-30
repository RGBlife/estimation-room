import { CARD_VALUES } from './avatar.js';

export function computeStats(participants) {
  const active = Object.values(participants).filter(p => !p.isObserver);
  const votes = active.filter(p => p.vote != null).map(p => p.vote);
  const anyVote = votes.length > 0;
  const allVoted = active.length > 0 && votes.length === active.length;
  const numeric = votes.map(parseFloat).filter(n => !isNaN(n));
  const hasAverage = numeric.length > 0;
  const average = hasAverage ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1) : null;
  const isWideSpread = numeric.length >= 2 && (Math.max(...numeric) - Math.min(...numeric) >= 8);
  return { anyVote, allVoted, hasAverage, average, isWideSpread };
}

export function computeDistribution(participants) {
  const groups = {};
  Object.values(participants).forEach(p => {
    if (!p.isObserver && p.vote != null) (groups[p.vote] = groups[p.vote] || []).push(p);
  });
  const maxCount = Math.max(1, ...Object.values(groups).map(g => g.length));
  return CARD_VALUES.filter(value => groups[value])
    .map(value => {
      const group = groups[value];
      return {
        value,
        count: group.length,
        isTop: group.length === maxCount,
        voters: group,
      };
    });
}
