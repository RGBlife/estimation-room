import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadProfile, saveProfile, loadLastRoomCode, saveLastRoomCode } from './profile.ts';
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

  it('round-trips a saved profile', () => {
    stubLocalStorage();
    const avatar = { seed: 'abc', bgIdx: 2, glasses: true, earrings: false, flair: false } as unknown as AvatarOptions;
    saveProfile({ name: 'Sam', avatar });
    expect(loadProfile()).toEqual({ name: 'Sam', avatar });
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
