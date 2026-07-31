// Keep the weaponId list here in sync with the regex in database.rules.json
// ("throws" path validation) — rules can't import this module.
export const WEAPONS = [
  { id: 'paper-airplane', label: 'Paper Airplane', shape: 'paper-airplane', impact: 'sp-impact-stick', flight: 'sp-fly-glide' },
  { id: 'heart', label: 'Heart', hasEmoji: true, glyph: '❤️', impact: 'sp-impact-pop' },
  { id: 'microwave', label: 'Microwave', shape: 'microwave', impact: 'sp-impact-shake' },
  { id: 'flower', label: 'Flower', hasEmoji: true, glyph: '🌸', impact: 'sp-impact-spin' },
  { id: 'bob-ross', label: 'Bob Ross', shape: 'custom-image', impact: 'sp-impact-splat', afterEffect: 'tree' },
  { id: 'snowball', label: 'Snowball', shape: 'snowball', impact: 'sp-frag-burst' },
  { id: 'rubber-duck', label: 'Rubber Duck', hasEmoji: true, glyph: '🦆', impact: 'sp-impact-bounce' },
  { id: 'confetti', label: 'Confetti', hasEmoji: true, glyph: '🎉', impact: 'sp-impact-burst' },
];

export const FRAG_ANGLES = [10, 60, 110, 160, 210, 260, 310];
