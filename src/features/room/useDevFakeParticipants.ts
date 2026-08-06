import { randomAvatar, CARD_VALUES } from '../avatar/index.js';
import type { Participant } from '../../types/room.ts';

// Dev-only layout testing: ?fakes=N&fakeobs=M merges N fake voters and M fake
// observers into the room client-side. Never written to Firestore, stripped
// from production builds.
export const FAKE_PARTICIPANTS: Record<string, Participant> | null = (() => {
  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(window.location.search);
  const fakes = Number(params.get('fakes') || 0);
  const fakeObs = Number(params.get('fakeobs') || 0);
  if (!fakes && !fakeObs) return null;
  const out: Record<string, Participant> = {};
  for (let i = 0; i < fakes + fakeObs; i++) {
    out[`fake-${i}`] = {
      name: `Player ${i + 1}`,
      avatar: randomAvatar(),
      joinedAt: 1e12 + i,
      isObserver: i >= fakes,
      vote: i < fakes ? CARD_VALUES[i % 8] : null,
    };
  }
  return out;
})();
