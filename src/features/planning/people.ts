import { useEffect, useState } from 'react';
import type { Participant } from '../../types/room.ts';
import { AVATAR_BG } from '../avatar/avatar.ts';

// Each person writes in their avatar's colour: their highlights, their edit
// tags. Someone who has left keeps a stable colour derived from their id.
export function personColor(uid: string, participants: Record<string, Participant>): string {
  const avatar = participants[uid]?.avatar;
  if (avatar && 'bgIdx' in avatar && AVATAR_BG[avatar.bgIdx]) return `#${AVATAR_BG[avatar.bgIdx]}`;
  let hash = 0;
  for (const c of uid) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return `#${AVATAR_BG[hash % AVATAR_BG.length]}`;
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' });
export function timeAgo(at: number, now: number): string {
  const seconds = Math.round((at - now) / 1000);
  if (seconds > -45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes > -60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, 'hour');
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Re-renders relative times while something is on screen.
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
