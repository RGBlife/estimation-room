import { useMemo } from 'react';
import { create } from 'zustand';
import type { DuelFrame, DuelView } from '../../types/games.ts';

// Frames of the games that move by themselves (a ball, a light cycle, a
// rival's typing), up to twenty a second. They're kept apart from the room's
// state so that only the game on screen redraws for them, not the table.
export const useDuelFrames = create<{ frames: Record<string, DuelFrame> }>(() => ({ frames: {} }));

export const pushFrame = (frame: DuelFrame) =>
  useDuelFrames.setState(s => ({ frames: { ...s.frames, [frame.id]: { ...s.frames[frame.id], ...frame } } }));

// A full state supersedes every frame before it.
export const clearFrames = () => useDuelFrames.setState({ frames: {} });

// The duel as it stands now: its last full state, with any newer frame over it.
export function useLiveDuel(duel: DuelView): DuelView {
  const frame = useDuelFrames(s => s.frames[duel.id]);
  return useMemo(() => frame ? { ...duel, ...frame } : duel, [duel, frame]);
}
