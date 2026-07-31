import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';

export const AVATAR_BG = [
  '5B6EE1', '8B6FD1', 'C97BB0', '5FAE8E',
  '4FA8B8', 'C99A4E', 'B5A66A', 'C97A56',
];

export const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '20', '?', '☕'];

const HAIR = [
  'short01', 'short02', 'short03', 'short04', 'short05', 'short06', 'short07', 'short08',
  'short09', 'short10', 'short11', 'short12', 'short13', 'short14', 'short15', 'short16',
  'short17', 'short18', 'short19',
  'long01', 'long02', 'long03', 'long04', 'long05', 'long06', 'long07', 'long08',
  'long09', 'long10', 'long11', 'long12', 'long13', 'long14', 'long15', 'long16',
  'long17', 'long18', 'long19', 'long20', 'long21', 'long22', 'long23', 'long24',
  'long25', 'long26',
];

const HAIR_COLOR = [
  'ac6511', 'cb6820', 'ab2a18', 'e5d7a3', 'b9a05f', '796a45', '6a4e35',
  '562306', '0e0e0e', 'afafaf', '3eac2c', '85c2c6', 'dba3be', '592454',
];

const SKIN_COLOR = ['f2d3b1', 'ecad80', '9e5622', '763900'];

const EYES = Array.from({ length: 26 }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`);
const EYEBROWS = Array.from({ length: 15 }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`);
const MOUTH = Array.from({ length: 30 }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`);
const GLASSES = Array.from({ length: 5 }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`);
const EARRINGS = Array.from({ length: 6 }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`);
const FEATURES = ['mustache', 'blush', 'birthmark', 'freckles'];

// Every customizable category, in left-rail display order. `values` holds the
// option list the index picks into (color categories reuse the hex swatches).
// `pro` marks the joke paywalled tab.
export const AVATAR_CATEGORIES = [
  { key: 'hairIdx', label: 'Hair', values: HAIR },
  { key: 'hairColorIdx', label: 'Hair Color', values: HAIR_COLOR, swatch: true },
  { key: 'skinColorIdx', label: 'Skin', values: SKIN_COLOR, swatch: true },
  { key: 'eyesIdx', label: 'Eyes', values: EYES },
  { key: 'eyebrowsIdx', label: 'Brows', values: EYEBROWS },
  { key: 'mouthIdx', label: 'Mouth', values: MOUTH },
  { key: 'glassesIdx', label: 'Glasses', values: GLASSES, optional: true },
  { key: 'earringsIdx', label: 'Earrings', values: EARRINGS, optional: true },
  { key: 'featureIdx', label: 'Extras', values: FEATURES, optional: true, pro: true },
];

export function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

function randInt(max) {
  return Math.floor(Math.random() * max);
}

// Produces a fresh set of category picks. Optional categories (glasses,
// earrings, extras) start off since Dicebear's *Probability options control
// whether they render at all, separate from which variant is selected.
export function randomAvatar() {
  const avatar = { seed: randomSeed(), bgIdx: randInt(AVATAR_BG.length) };
  for (const cat of AVATAR_CATEGORIES) {
    avatar[cat.key] = randInt(cat.values.length);
    if (cat.optional) avatar[`${cat.key}On`] = false;
  }
  return avatar;
}

// Avatars are generated locally and participants store just the options
// (seed/bgIdx/category indices), so rendering never depends on the dicebear
// API being reachable. Cached because seat/preview renders repeat the same
// avatar often.
const uriCache = new Map();

function idx(avatar, key, len, fallback = 0) {
  const v = avatar?.[key];
  return Number.isInteger(v) && v >= 0 && v < len ? v : fallback;
}

export function avatarDataUri(avatar) {
  const a = avatar || {};
  const seed = a.seed ?? '';
  const bgIdx = idx(a, 'bgIdx', AVATAR_BG.length);

  const hair = HAIR[idx(a, 'hairIdx', HAIR.length)];
  const hairColor = HAIR_COLOR[idx(a, 'hairColorIdx', HAIR_COLOR.length)];
  const skinColor = SKIN_COLOR[idx(a, 'skinColorIdx', SKIN_COLOR.length)];
  const eyes = EYES[idx(a, 'eyesIdx', EYES.length)];
  const eyebrows = EYEBROWS[idx(a, 'eyebrowsIdx', EYEBROWS.length)];
  const mouth = MOUTH[idx(a, 'mouthIdx', MOUTH.length)];
  const glasses = GLASSES[idx(a, 'glassesIdx', GLASSES.length)];
  const earrings = EARRINGS[idx(a, 'earringsIdx', EARRINGS.length)];
  const feature = FEATURES[idx(a, 'featureIdx', FEATURES.length)];

  // Legacy boolean toggles (pre-customization-panel profiles) still turn
  // glasses/earrings/flair on; new profiles use the explicit *On flags.
  const glassesOn = a.glassesIdxOn ?? a.glasses ?? false;
  const earringsOn = a.earringsIdxOn ?? a.earrings ?? false;
  const featureOn = a.featureIdxOn ?? a.flair ?? false;

  const key = [
    seed, bgIdx, hair, hairColor, skinColor, eyes, eyebrows, mouth,
    glassesOn ? glasses : '-', earringsOn ? earrings : '-', featureOn ? feature : '-',
  ].join('|');

  const hit = uriCache.get(key);
  if (hit) return hit;

  const uri = createAvatar(adventurer, {
    seed: String(seed),
    backgroundColor: [AVATAR_BG[bgIdx] ?? AVATAR_BG[0]],
    backgroundType: ['solid'],
    hair: [hair],
    hairColor: [hairColor],
    hairProbability: 100,
    skinColor: [skinColor],
    eyes: [eyes],
    eyebrows: [eyebrows],
    mouth: [mouth],
    glasses: [glasses],
    glassesProbability: glassesOn ? 100 : 0,
    earrings: [earrings],
    earringsProbability: earringsOn ? 100 : 0,
    features: [feature],
    featuresProbability: featureOn ? 100 : 0,
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

// Renders `avatar` as if `categoryKey` were set to `valueIdx` (and, for
// optional categories, switched on) — used by the customize panel to show a
// true thumbnail per option without mutating the actual selection.
export function avatarPreviewUri(avatar, categoryKey, valueIdx, optional) {
  const overrides = { [categoryKey]: valueIdx };
  if (optional) overrides[`${categoryKey}On`] = true;
  return avatarDataUri({ ...avatar, ...overrides });
}
