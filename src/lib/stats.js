export function computeStats(participants) {
  const votes = Object.values(participants)
    .filter(p => !p.isObserver && p.vote != null)
    .map(p => p.vote);
  const anyVote = votes.length > 0;
  const numeric = votes.map(parseFloat).filter(n => !isNaN(n));
  const hasAverage = numeric.length > 0;
  const average = hasAverage ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1) : null;
  const isWideSpread = numeric.length >= 2 && (Math.max(...numeric) - Math.min(...numeric) >= 8);
  return { anyVote, hasAverage, average, isWideSpread };
}
