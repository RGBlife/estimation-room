import {
  ref as rtdbRef, onValue, onDisconnect, set as rtdbSet, remove as rtdbRemove,
  push, query, orderByChild, startAt, onChildAdded, type Unsubscribe,
} from 'firebase/database';
import { rtdb } from '../../shared/lib/firebase.ts';
import type { DriverState, TableCrackEvent, TablePieceMove, WastedMap } from '../../types/gta.ts';

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
let lastPublishedPhase: string | null = null;
let myDriverRef: ReturnType<typeof rtdbRef> | null = null;

// Starts publishing this client's car position, and registers disconnect
// cleanup so a crashed/closed tab doesn't leave a ghost car parked forever.
export function startDriving(code: string, uid: string): void {
  myDriverRef = rtdbRef(rtdb, `gta/${code}/${uid}`);
  onDisconnect(myDriverRef).remove().catch(() => {});
  lastPublishAt = 0;
  lastPublishedPhase = null;
}

// Publishes one pose sample, throttled to PUBLISH_INTERVAL_MS. Safe to call
// every animation frame -- the caller doesn't need to know the throttle.
export function publishDriverState(state: Omit<DriverState, 'uid'>): void {
  if (!myDriverRef) return;
  const now = performance.now();
  // hit is transient and must always land the frame it happens, even if a
  // throttled tick would otherwise have been skipped -- a dropped hit just
  // means a missed animation, but throttling it away entirely would be worse.
  // A phase change bypasses the throttle too: arriving/boarding/exploding/
  // returning are each played once, so a remote viewer waiting out a stale
  // throttle window would visibly lag behind the local driver's own
  // transition instead of starting the matching animation in step.
  const phaseChanged = state.phase !== lastPublishedPhase;
  if (now - lastPublishAt < PUBLISH_INTERVAL_MS && !state.hit && !phaseChanged) return;
  lastPublishAt = now;
  lastPublishedPhase = state.phase;
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

// Live table-damage sync, under the RTDB `gtaTable` path -- cracks
// (push-keyed, append-only) and wasted uids (per-key booleans) so every
// client renders the same table condition, not just the driver whose car
// caused it. See TableCrackEvent/WastedMap in types/gta.ts for why each
// uses the shape it does.
let cracksUnsubscribe: Unsubscribe | null = null;
let wastedUnsubscribe: Unsubscribe | null = null;
let cracksSubscribeStartAt = 0;

// Writes one crack. Fire-and-forget like throwWeaponAction -- a dropped
// write just means one client never sees that particular crack, which is
// no worse than a dropped position sample already is elsewhere in this file.
export function publishTableCrack(code: string, uid: string, crack: Omit<TableCrackEvent, 'id' | 'fromUid' | 'ts'>): void {
  const crackRef = push(rtdbRef(rtdb, `gtaTable/${code}/cracks`));
  rtdbSet(crackRef, { ...crack, fromUid: uid, ts: Date.now() }).catch(() => {});
}

// Subscribes to new cracks for the room. Uses startAt(now) for the same
// reason subscribeThrows in roomStore.ts does -- a client that joins
// mid-round would otherwise replay every crack from the start of the round
// as if they'd just landed, animating decals that are actually old news.
// (A freshly-joined client also can't see the round's crack *history*, but
// cracks/wasted reset on every round anyway, so mid-round joiners missing
// the replay is a smaller gap than the sandbox-only staleness this avoids.)
export function subscribeTableCracks(code: string, set: (fn: (state: { tableCracks: TableCrackEvent[] }) => Partial<{ tableCracks: TableCrackEvent[] }>) => void): void {
  if (cracksUnsubscribe) { cracksUnsubscribe(); cracksUnsubscribe = null; }
  set(() => ({ tableCracks: [] }));
  cracksSubscribeStartAt = Date.now();
  const cracksQuery = query(
    rtdbRef(rtdb, `gtaTable/${code}/cracks`),
    orderByChild('ts'),
    startAt(cracksSubscribeStartAt),
  );
  cracksUnsubscribe = onChildAdded(cracksQuery, snap => {
    const val = snap.val();
    if (!val || val.ts < cracksSubscribeStartAt) return;
    set(state => ({ tableCracks: [...state.tableCracks, { id: snap.key!, ...val }] }));
  });
}

// Each split piece's cumulative shove is one mutable node per side (unlike
// cracks) because it's a running total, not an independent event -- every
// hit needs to read where the piece currently is and add to it, so whoever's
// car detects the hit overwrites the whole node with the new total.
export function publishTablePieceMove(code: string, side: 'left' | 'right', move: TablePieceMove): void {
  rtdbSet(rtdbRef(rtdb, `gtaTable/${code}/pieceMove/${side}`), move).catch(() => {});
}

export function markWasted(code: string, targetUid: string): void {
  rtdbSet(rtdbRef(rtdb, `gtaTable/${code}/wasted/${targetUid}`), true).catch(() => {});
}

// Clears all table damage for a new round. remove() is idempotent, so it's
// safe for every client watching the reveal->unrevealed transition to call
// this independently (see SeatTable.tsx) without coordinating who "owns"
// the reset -- whichever write lands first wins, and the rest are no-ops.
export function resetTableDamage(code: string): void {
  rtdbRemove(rtdbRef(rtdb, `gtaTable/${code}`)).catch(() => {});
}

// Subscribes to piece-shove and wasted-uid state together -- both live under
// the same gtaTable/$roomCode node as cracks, so one listener on the whole
// subtree covers all of it rather than juggling three separate onValue calls.
export function subscribeTableDamage(
  code: string,
  set: (fn: (state: { tablePieceMove: { left: TablePieceMove; right: TablePieceMove }; tableWasted: WastedMap }) => Partial<{ tablePieceMove: { left: TablePieceMove; right: TablePieceMove }; tableWasted: WastedMap }>) => void,
): void {
  if (wastedUnsubscribe) { wastedUnsubscribe(); wastedUnsubscribe = null; }
  const zero: TablePieceMove = { x: 0, y: 0, rot: 0 };
  set(() => ({ tablePieceMove: { left: zero, right: zero }, tableWasted: {} }));
  const tableRef = rtdbRef(rtdb, `gtaTable/${code}`);
  wastedUnsubscribe = onValue(tableRef, snap => {
    const val = snap.val() as { pieceMove?: { left?: TablePieceMove; right?: TablePieceMove }; wasted?: WastedMap } | null;
    set(() => ({
      tablePieceMove: {
        left: val?.pieceMove?.left ?? zero,
        right: val?.pieceMove?.right ?? zero,
      },
      tableWasted: val?.wasted ?? {},
    }));
  });
}

export function teardownGta(): void {
  if (driversUnsubscribe) { driversUnsubscribe(); driversUnsubscribe = null; }
  if (cracksUnsubscribe) { cracksUnsubscribe(); cracksUnsubscribe = null; }
  if (wastedUnsubscribe) { wastedUnsubscribe(); wastedUnsubscribe = null; }
  stopDriving();
  lastPublishAt = 0;
  lastPublishedPhase = null;
}
