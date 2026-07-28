import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadProfile, saveProfile } from './profile.js';

function stubLocalStorage(store = {}) {
  vi.stubGlobal('localStorage', {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  });
  return store;
}

describe('profile persistence', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('round-trips a saved profile', () => {
    stubLocalStorage();
    const avatar = { seed: 'abc', bgIdx: 2, glasses: true, earrings: false, flair: false };
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
    expect(() => saveProfile({ name: 'x', avatar: {} })).not.toThrow();
    expect(loadProfile()).toBe(null);
  });
});
