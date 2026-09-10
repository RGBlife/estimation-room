import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadProfile, saveProfile, loadLastRoomCode, saveLastRoomCode } from './profile.ts';
import { normalizeAvatar } from '../avatar/avatar.ts';
import type { AvatarOptions } from '../../types/room.ts';

function stubLocalStorage(store: Record<string, string> = {}) {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
  });
  return store;
}

describe('profile persistence', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('migrates a saved legacy profile', () => {
    stubLocalStorage();
    const avatar = { seed: 'abc', bgIdx: 2, glasses: true, earrings: false, flair: false } as unknown as AvatarOptions;
    saveProfile({ name: 'Sam', avatar });
    expect(loadProfile()).toEqual({ name: 'Sam', avatar: normalizeAvatar(avatar) });
  });

  it('round-trips a saved observer role', () => {
    stubLocalStorage();
    const avatar = { seed: 'abc', bgIdx: 2, glasses: true, earrings: false, flair: false } as unknown as AvatarOptions;
    saveProfile({ name: 'Sam', avatar, isObserver: true });
    expect(loadProfile()).toEqual({ name: 'Sam', avatar: normalizeAvatar(avatar), isObserver: true });
  });

  it('returns null when nothing is stored', () => {
    stubLocalStorage();
    expect(loadProfile()).toBe(null);
  });

  it('returns null for corrupt or shape-less data', () => {
    const store = stubLocalStorage();
    store.sp_profile = 'not json';
    expect(loadProfile()).toBe(null);
    store.sp_profile = JSON.stringify({ name: 'no avatar' });
    expect(loadProfile()).toBe(null);
  });

  it('survives localStorage being unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    });
    expect(() => saveProfile({ name: 'x', avatar: {} as AvatarOptions })).not.toThrow();
    expect(loadProfile()).toBe(null);
  });
});

describe('last room code persistence', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('round-trips a saved room code', () => {
    stubLocalStorage();
    saveLastRoomCode('ABC123');
    expect(loadLastRoomCode()).toBe('ABC123');
  });

  it('returns null when nothing is stored', () => {
    stubLocalStorage();
    expect(loadLastRoomCode()).toBe(null);
  });

  it('survives localStorage being unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    });
    expect(() => saveLastRoomCode('ABC123')).not.toThrow();
    expect(loadLastRoomCode()).toBe(null);
  });
});

it('repairs a hybrid legacy avatar before it can be submitted to Firebase', () => {
  stubLocalStorage({ sp_profile: JSON.stringify({
    name: 'Sam', avatar: { seed: 'old', bgIdx: 2, glasses: true, earrings: false, flair: false, hairIdx: 12, eyesIdx: 999, unknown: true },
  }) });
  const avatar = loadProfile()!.avatar;
  expect(avatar.hairIdx).toBe(12);
  expect(avatar.eyesIdx).toBe(0);
  expect(avatar.glassesIdxOn).toBe(true);
  expect(Object.keys(avatar)).toHaveLength(14);
  expect(avatar).not.toHaveProperty('glasses');
  expect(avatar).not.toHaveProperty('unknown');
});
