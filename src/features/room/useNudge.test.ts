import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useNudge } from './useNudge.ts';
import type { Participant } from '../../types/room.ts';
import type { ThrowEvent } from '../../types/throws.ts';

const participants: Record<string, Participant> = {
  a: { name: 'Ada', vote: null, joinedAt: 0, isObserver: false },
  b: { name: 'Bo', vote: null, joinedAt: 0, isObserver: false },
};
const event = (id: string): ThrowEvent => ({ id, fromUid: 'b', toUid: 'a', weaponId: 'nudge', ts: 0, offsetX: 0, offsetY: 0 });
const animate = vi.fn(() => ({ cancel: vi.fn() }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  document.body.innerHTML = '<div class="sp-app"></div>';
  Object.defineProperty(document.querySelector('.sp-app'), 'animate', { value: animate });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('nudges only the target and suppresses a burst from multiple teammates', () => {
  const { result, rerender } = renderHook(({ events }) => useNudge(events, 'a', participants, false), { initialProps: { events: [event('1')] } });
  expect(result.current).toContain('Bo nudged you');
  expect(animate).toHaveBeenCalledOnce();
  rerender({ events: [event('1'), event('2')] });
  expect(animate).toHaveBeenCalledOnce();
  act(() => vi.advanceTimersByTime(4000));
  expect(result.current).toBeNull();
});

it('uses a text reminder without shaking when reduced motion is enabled', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const { result } = renderHook(() => useNudge([event('1')], 'a', participants, false));
  expect(result.current).toContain('Bo nudged you');
  expect(animate).not.toHaveBeenCalled();
});

it.each(['voted', 'observer', 'revealed', 'other'])('ignores nudges when %s', kind => {
  const next = { ...participants, a: { ...participants.a, vote: kind === 'voted' ? '3' : null, isObserver: kind === 'observer' } };
  const { result } = renderHook(() => useNudge([event('1')], kind === 'other' ? 'b' : 'a', next, kind === 'revealed'));
  expect(result.current).toBeNull();
  expect(animate).not.toHaveBeenCalled();
});
