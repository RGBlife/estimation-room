import { doc, updateDoc, deleteField } from 'firebase/firestore';
import {
  ref as rtdbRef, onValue, onDisconnect, set as rtdbSet, remove as rtdbRemove, type Unsubscribe,
} from 'firebase/database';
import { db, rtdb } from '../../shared/lib/firebase.ts';
import type { RoomDoc } from '../../types/room.ts';

// How long a participant must be continuously absent from presence before any
// client removes them from the room. Absorbs brief RTDB reconnects, which
// would otherwise get people kicked (and their next write would recreate them
// as a corrupt half-participant).
const STALE_GRACE_MS = 8000;

// Module-level state replacing the useRef()s the original hook used --
// each concern (per-room presence subscription lifecycle) has no React
// component tied to it anymore, so plain mutable variables here play the
// same role a ref's `.current` did.
let presenceUnsubscribe: Unsubscribe | null = null;
let connectedUnsubscribe: Unsubscribe | null = null;
let graceTimer: ReturnType<typeof setTimeout> | null = null;
let staleSince: Record<string, number> = {};
let presenceSnapshot: Record<string, boolean> = {};

export function clearMyPresence(code: string, myUid: string): void {
  const myPresenceRef = rtdbRef(rtdb, `presence/${code}/${myUid}`);
  onDisconnect(myPresenceRef).cancel().catch(() => {});
  rtdbRemove(myPresenceRef).catch(() => {});
}

// Removes participants who have been absent from presence for the full grace
// period. Runs on every presence change and re-schedules itself while
// anyone's absence is still within the grace window.
function reviewPresence(code: string, myUid: string, getRoom: () => RoomDoc | null): void {
  if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
  const currentRoom = getRoom();
  if (!currentRoom) return;
  const present = presenceSnapshot;
  // If our own presence entry is missing, we may be the one who lost the
  // connection — our view of who's present is suspect, so remove no one.
  if (!(myUid in present)) return;
  const now = Date.now();
  const participantIds = Object.keys(currentRoom.participants);
  for (const id of Object.keys(staleSince)) {
    if (!participantIds.includes(id) || id in present) delete staleSince[id];
  }
  let nextCheckAt = Infinity;
  for (const id of participantIds) {
    if (id in present || id === myUid) continue;
    if (!(id in staleSince)) staleSince[id] = now;
    const dueAt = staleSince[id] + STALE_GRACE_MS;
    if (dueAt <= now) {
      // Security rules allow removing only one other participant per write.
      updateDoc(doc(db, 'rooms', code), { [`participants.${id}`]: deleteField() }).catch(() => {});
    } else {
      nextCheckAt = Math.min(nextCheckAt, dueAt);
    }
  }
  if (nextCheckAt < Infinity) {
    graceTimer = setTimeout(() => reviewPresence(code, myUid, getRoom), nextCheckAt - now + 50);
  }
}

// Marks this client present in the room via Realtime Database, which (unlike
// Firestore) can detect disconnects — clean tab close, crash, or network loss —
// server-side via onDisconnect(), even when our own JS never gets to run again.
export function trackPresence(code: string, myUid: string, getRoom: () => RoomDoc | null): void {
  const myPresenceRef = rtdbRef(rtdb, `presence/${code}/${myUid}`);

  // Register presence on every (re)connect, not just once: the server
  // discards an onDisconnect handler after it fires, so after a network blip
  // we'd otherwise stay absent from presence and get purged from the room.
  if (connectedUnsubscribe) connectedUnsubscribe();
  connectedUnsubscribe = onValue(rtdbRef(rtdb, '.info/connected'), snap => {
    if (snap.val() !== true) return;
    onDisconnect(myPresenceRef).remove().catch(() => {});
    rtdbSet(myPresenceRef, true).catch(() => {});
  });

  if (presenceUnsubscribe) presenceUnsubscribe();
  staleSince = {};
  presenceSnapshot = {};
  const roomPresenceRef = rtdbRef(rtdb, `presence/${code}`);
  presenceUnsubscribe = onValue(roomPresenceRef, snap => {
    presenceSnapshot = snap.val() || {};
    reviewPresence(code, myUid, getRoom);
  });
}

export function teardownPresence(): void {
  if (presenceUnsubscribe) { presenceUnsubscribe(); presenceUnsubscribe = null; }
  if (connectedUnsubscribe) { connectedUnsubscribe(); connectedUnsubscribe = null; }
  if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
  staleSince = {};
  presenceSnapshot = {};
}
