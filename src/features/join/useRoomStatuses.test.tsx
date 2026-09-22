import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRoomStatuses } from './useRoomStatuses.ts';

describe('useRoomStatuses', () => {
  it('checks each room once the connection is ready, and reports closed rooms', async () => {
    const peek = vi.fn(async (code: string) => (code === 'GONE' ? null : { participants: [{ name: 'Sam', isObserver: false }] }));
    const { result, rerender } = renderHook(({ ready }) => useRoomStatuses(['ABCD', 'GONE'], peek, ready), { initialProps: { ready: false } });
    expect(peek).not.toHaveBeenCalled();
    rerender({ ready: true });
    await waitFor(() => expect(result.current.statuses.GONE).toEqual({ kind: 'closed' }));
    expect(result.current.statuses.ABCD).toEqual({ kind: 'open', people: [{ name: 'Sam', isObserver: false }] });
    expect(peek).toHaveBeenCalledTimes(2);
    rerender({ ready: true });
    expect(peek).toHaveBeenCalledTimes(2);
  });

  it('falls back to unknown when a check fails, and can be asked again', async () => {
    const peek = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ participants: [] });
    const { result } = renderHook(() => useRoomStatuses(['ABCD'], peek, true));
    await waitFor(() => expect(result.current.statuses.ABCD).toEqual({ kind: 'unknown' }));
    result.current.refresh('ABCD');
    await waitFor(() => expect(result.current.statuses.ABCD).toEqual({ kind: 'open', people: [] }));
  });

  it('does nothing without a peek function', () => {
    const { result } = renderHook(() => useRoomStatuses(['ABCD'], undefined, true));
    expect(result.current.statuses).toEqual({});
  });
});
