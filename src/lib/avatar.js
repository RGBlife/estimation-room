import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';

export const AVATAR_BG = [
  '5B6EE1', '8B6FD1', 'C97BB0', '5FAE8E',
  '4FA8B8', 'C99A4E', 'B5A66A', 'C97A56',
];

export const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '20', '?', '☕'];

export function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

// Avatars are generated locally and participants store just the options
// (seed/bgIdx/toggles), so rendering never depends on the dicebear API being
// reachable. Cached because seat/preview renders repeat the same avatar often.
const uriCache = new Map();

export function avatarDataUri(avatar) {
  const { seed = '', bgIdx = 0, glasses = false, earrings = false, flair = false } = avatar || {};
  const key = `${seed}|${bgIdx}|${glasses ? 1 : 0}${earrings ? 1 : 0}${flair ? 1 : 0}`;
  const hit = uriCache.get(key);
  if (hit) return hit;
  const uri = createAvatar(adventurer, {
    seed: String(seed),
    backgroundColor: [AVATAR_BG[bgIdx] ?? AVATAR_BG[0]],
    backgroundType: ['solid'],
    glassesProbability: glasses ? 100 : 0,
    earringsProbability: earrings ? 100 : 0,
    featuresProbability: flair ? 100 : 0,
  }).toDataUri();
  if (uriCache.size > 256) uriCache.clear();
  uriCache.set(key, uri);
  return uri;
}

// Participants written by builds prior to local avatar generation stored a
// dicebear API URL instead of options.
export function participantAvatarSrc(participant) {
  return participant.avatar ? avatarDataUri(participant.avatar) : participant.avatarUrl;
}
