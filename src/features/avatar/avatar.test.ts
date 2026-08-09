import { describe, it, expect } from 'vitest';
import { avatarDataUri, participantAvatarSrc, AVATAR_BG } from './avatar.ts';

const base = { seed: 'test-seed', bgIdx: 1, glasses: false, earrings: false, flair: false };

describe('avatarDataUri', () => {
  it('renders an inline SVG data URI with the chosen background', () => {
    const uri = avatarDataUri(base);
    expect(uri).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(uri)).toContain(AVATAR_BG[1]);
  });

  it('is deterministic for the same options and returns the cached instance', () => {
    expect(avatarDataUri({ ...base })).toBe(avatarDataUri({ ...base }));
  });

  it('varies with category picks and toggles', () => {
    const plain = avatarDataUri(base);
    expect(avatarDataUri({ ...base, hairIdx: 3 })).not.toBe(plain);
    expect(avatarDataUri({ ...base, glasses: true })).not.toEqual(plain);
  });

  it('tolerates missing or out-of-range options', () => {
    expect(avatarDataUri(null)).toMatch(/^data:image\/svg\+xml/);
    expect(avatarDataUri({ seed: 'x', bgIdx: 99 })).toMatch(/^data:image\/svg\+xml/);
  });
});

describe('participantAvatarSrc', () => {
  it('renders locally when avatar options are present', () => {
    expect(participantAvatarSrc({ avatar: base })).toMatch(/^data:image\/svg\+xml/);
  });

  it('falls back to the legacy stored URL', () => {
    const url = 'https://api.dicebear.com/9.x/adventurer/svg?seed=old';
    expect(participantAvatarSrc({ avatarUrl: url })).toBe(url);
  });
});
