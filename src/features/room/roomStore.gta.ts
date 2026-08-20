import {
  ref as rtdbRef, onValue, onDisconnect, set as rtdbSet, remove as rtdbRemove, type Unsubscribe,
} from 'firebase/database';
import { rtdb } from '../../shared/lib/firebase.ts';
import type { DriverState } from '../../types/gta.ts';

// Live driver-position sync for GTA Mode, under the RTDB `gta` path. Unlike
// throws (one-shot, push-keyed events) this is a single mutable node per
// driver, overwritten continuously while driving and removed on exit -- so
// unlike roomStore.presence.ts's boolean flags, this module streams full
// pose data every tick.
//
// Module-level state, same reasoning as roomStore.presence.ts: this is
// scoped to "am I currently driving in this room," not to a component's
// mount lifecycle.

// Caps outgoing writes well below the 60fps physics tick -- RTDB has no
// interpolation of its own, so remote viewers only need enough samples per
// second to interpolate a smooth path between them, not every frame.
const PUBLISH_INTERVAL_MS = 50;

let driversUnsubscribe: Unsubscribe | null = null;
let lastPublishAt = 0;
let myDriverRef: ReturnType<typeof rtdbRef> | null = null;

// Starts publishing this client's car position, and registers disconnect
// cleanup so a crashed/closed tab doesn't leave a ghost car parked forever.
export function startDriving(code: string, uid: string): void {
  myDriverRef = rtdbRef(rtdb, `gta/${code}/${uid}`);
  onDisconnect(myDriverRef).remove().catch(() => {});
  lastPublishAt = 0;
}

// Publishes one pose sample, throttled to PUBLISH_INTERVAL_MS. Safe to call
// every animation frame -- the caller doesn't need to know the throttle.
export function publishDriverState(state: Omit<DriverState, 'uid'>): void {
  if (!myDriverRef) return;
  const now = performance.now();
  // hit is transient and must always land the frame it happens, even if a
  // throttled tick would otherwise have been skipped -- a dropped hit just
  // means a missed animation, but throttling it away entirely would be worse.
  if (now - lastPublishAt < PUBLISH_INTERVAL_MS && !state.hit) return;
  lastPublishAt = now;
  rtdbSet(myDriverRef, state).catch(() => {});
}

// Stops publishing and removes this client's car so it disappears for
// everyone immediately, rather than waiting on onDisconnect (which only
// fires for an actual connection drop, not a normal exit).
export function stopDriving(): void {
  if (myDriverRef) {
    onDisconnect(myDriverRef).cancel().catch(() => {});
    rtdbRemove(myDriverRef).catch(() => {});
    myDriverRef = null;
  }
}

// Subscribes to every driver's live state in the room, including our own --
// the caller filters that out where it would otherwise double-render.
export function subscribeDrivers(code: string, set: (fn: (state: { drivers: Record<string, DriverState> }) => Partial<{ drivers: Record<string, DriverState> }>) => void): void {
  if (driversUnsubscribe) { driversUnsubscribe(); driversUnsubscribe = null; }
  set(() => ({ drivers: {} }));
  const driversRef = rtdbRef(rtdb, `gta/${code}`);
  driversUnsubscribe = onValue(driversRef, snap => {
    const val = snap.val() as Record<string, Omit<DriverState, 'uid'>> | null;
    const drivers: Record<string, DriverState> = {};
    if (val) {
      for (const [uid, d] of Object.entries(val)) drivers[uid] = { uid, ...d };
    }
    set(() => ({ drivers }));
  });
}

export function teardownGta(): void {
  if (driversUnsubscribe) { driversUnsubscribe(); driversUnsubscribe = null; }
  stopDriving();
  lastPublishAt = 0;
}
