export const AVATAR_BG = [
  '5B6EE1', '8B6FD1', 'C97BB0', '5FAE8E',
  '4FA8B8', 'C99A4E', 'B5A66A', 'C97A56',
];

export const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '20', '?', '☕'];

export function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

export function buildAdventurerUrl(seed, bgHex, glasses, earrings, flair) {
  let url = 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + encodeURIComponent(seed) +
    '&backgroundColor=' + bgHex + '&backgroundType=solid';
  url += '&glassesProbability=' + (glasses ? 100 : 0);
  url += '&earringsProbability=' + (earrings ? 100 : 0);
  url += '&featuresProbability=' + (flair ? 100 : 0);
  return url;
}
