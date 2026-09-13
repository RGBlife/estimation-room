import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSnapshot } from 'firebase/database';
import type { DriverState } from '../../types/gta.ts';

const listeners = vi.hoisted(() => new Map<string, (snap: DataSnapshot) => void>());
const write = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../shared/lib/firebase.ts', () => ({ rtdb: {} }));
vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => path,
  set: write,
  remove: vi.fn().mockResolvedValue(undefined),
  push: vi.fn(),
  onDisconnect: () => ({ remove: vi.fn().mockResolvedValue(undefined), cancel: vi.fn().mockResolvedValue(undefined) }),
  onValue: vi.fn(() => vi.fn()),
  onChildAdded: (_ref: unknown, cb: (snap: DataSnapshot) => void) => { listeners.set('add', cb); return vi.fn(); },
  onChildChanged: (_ref: unknown, cb: (snap: DataSnapshot) => void) => { listeners.set('change', cb); return vi.fn(); },
  onChildRemoved: (_ref: unknown, cb: (snap: DataSnapshot) => void) => { listeners.set('remove', cb); return vi.fn(); },
}));
const { subscribeDrivers, startDriving, publishDriverState, teardownGta } = await import('./roomStore.gta.ts');
const pose = { x: .2, y: .3, r: 0, t: 1, phase: 'driving', hit: null };
const emit = (kind: string, uid: string, value = pose) => listeners.get(kind)!({ key: uid, val: () => value } as unknown as DataSnapshot);

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => { teardownGta(); vi.useRealTimers(); });

describe('multiplayer driver sync', () => {
  it('combines seven driver updates while preserving unchanged driver objects', () => {
    const publish = vi.fn();
    subscribeDrivers('ROOM', publish);
    for (let i = 0; i < 7; i++) emit('add', `u${i}`);
    expect(publish).toHaveBeenCalledTimes(1); // initial empty state
    vi.advanceTimersByTime(50);
    const first = publish.mock.lastCall![0]().drivers as Record<string, DriverState>;
    expect(Object.keys(first)).toHaveLength(7);
    emit('change', 'u1', { ...pose, x: .4 });
    vi.advanceTimersByTime(50);
    const next = publish.mock.lastCall![0]().drivers as Record<string, DriverState>;
    expect(next.u0).toBe(first.u0);
    expect(next.u1.x).toBe(.4);
  });
  it('delivers lifecycle changes and removals immediately and cancels pending work on teardown', () => {
    const publish = vi.fn();
    subscribeDrivers('ROOM', publish);
    emit('add', 'u1');
    vi.advanceTimersByTime(50);
    emit('change', 'u1', { ...pose, phase: 'exploding' });
    expect(publish.mock.lastCall![0]().drivers.u1.phase).toBe('exploding');
    emit('remove', 'u1');
    expect(publish.mock.lastCall![0]().drivers).toEqual({});
    emit('add', 'u2');
    teardownGta();
    const calls = publish.mock.calls.length;
    vi.advanceTimersByTime(100);
    expect(publish).toHaveBeenCalledTimes(calls);
  });
  it('does not flood writes for stationary cars or repeat-held collisions', () => {
    startDriving('ROOM', 'u1');
    publishDriverState(pose);
    for (let i = 0; i < 50; i++) { vi.advanceTimersByTime(16); publishDriverState(pose); }
    expect(write).toHaveBeenCalledTimes(1);
    const hit = { ...pose, hit: 'u2' };
    publishDriverState(hit);
    publishDriverState(hit);
    expect(write).toHaveBeenCalledTimes(2);
    publishDriverState({ ...hit, phase: 'exploding' });
    expect(write).toHaveBeenCalledTimes(3);
  });
});
