import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useClipboard } from './useClipboard.ts';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function setup(writeText = vi.fn().mockResolvedValue(undefined)) {
  vi.useFakeTimers();
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  return { ...renderHook(() => useClipboard()), writeText };
}

describe('clipboard feedback', () => {
  it('reports success only after writing and restarts the feedback timer', async () => {
    const { result, writeText } = setup();
    await act(() => result.current.copy('invite'));
    expect(writeText).toHaveBeenCalledWith('invite');
    expect(result.current.copied).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    await act(() => result.current.copy('invite again'));
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.copied).toBe(true);
    act(() => vi.advanceTimersByTime(900));
    expect(result.current.copied).toBe(false);
  });

  it('propagates failures without claiming success', async () => {
    const { result } = setup(vi.fn().mockRejectedValue(new Error('Denied')));
    await act(async () => { await expect(result.current.copy('invite')).rejects.toThrow('Denied'); });
    expect(result.current.copied).toBe(false);
  });

  it('ignores writes that finish after unmount', async () => {
    let finish!: () => void;
    const { result, unmount } = setup(vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })));
    let pending!: Promise<void>;
    act(() => { pending = result.current.copy('invite'); });
    unmount();
    await act(async () => { finish(); await pending; });
    expect(vi.getTimerCount()).toBe(0);
  });
});
