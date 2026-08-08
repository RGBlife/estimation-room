import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeckSwitchToast } from './useDeckSwitchToast.ts';

describe('useDeckSwitchToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no message and not rendered', () => {
    const { result } = renderHook(() => useDeckSwitchToast());
    expect(result.current.message).toBeNull();
    expect(result.current.rendered).toBe(false);
  });

  it('show() renders the message immediately, not closing', () => {
    const { result } = renderHook(() => useDeckSwitchToast());
    act(() => result.current.show('Deck switched to T-shirt'));
    expect(result.current.message).toBe('Deck switched to T-shirt');
    expect(result.current.rendered).toBe(true);
    expect(result.current.closing).toBe(false);
  });

  it('auto-dismisses after the visible timeout, then unmounts after the fade', () => {
    const { result } = renderHook(() => useDeckSwitchToast());
    act(() => result.current.show('Deck switched to T-shirt'));

    act(() => vi.advanceTimersByTime(2600));
    expect(result.current.closing).toBe(true);
    expect(result.current.rendered).toBe(true);

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.rendered).toBe(false);
    expect(result.current.closing).toBe(false);
  });

  it('dismiss() can be called manually before the timeout fires', () => {
    const { result } = renderHook(() => useDeckSwitchToast());
    act(() => result.current.show('Deck switched to T-shirt'));
    act(() => result.current.dismiss());
    expect(result.current.closing).toBe(true);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.rendered).toBe(false);
  });
});
