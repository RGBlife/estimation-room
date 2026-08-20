// Shape of a live driver's car state under the Realtime Database `gta` path.
// Unlike ThrowEvent (one-shot, push-keyed), this is a single mutable node per
// driver keyed by uid: a driver overwrites their own node ~30x/second while
// driving, and removes it when they stop.
//
// x/y are normalised 0..1 fractions of the stage box rather than pixels, so a
// driver on a wide monitor and a viewer on a laptop see the car in the same
// relative place. This mirrors ThrowEvent.offsetX/offsetY, which likewise
// stores a fraction of the target rather than absolute pixels.

export interface DriverState {
  uid: string; // RTDB key, attached client-side from snap.key
  x: number; // 0..1 fraction of stage width
  y: number; // 0..1 fraction of stage height
  r: number; // rotation, radians
  t: number; // ms timestamp, for staleness and interpolation
  // Set for the one frame a hard collision lands, naming who was hit. Rides
  // along on the position payload rather than getting its own RTDB path --
  // squashes are transient and self-healing, so a dropped packet costs one
  // missed animation, never a stuck flattened avatar.
  hit?: string | null;
  // The driver's lifecycle phase (GtaPhase, kept as a plain string here so
  // this type doesn't have to import from gtaLifecycle.ts). Streamed
  // continuously through every phase, not just 'driving' -- a remote viewer
  // needs to know when a driver is arriving/boarding/exploding/returning to
  // render the matching animation, not just interpolate a moving dot.
  phase: string;
}

// Driving input for one simulation step. Kept as a plain flags object (rather
// than reading the keyboard inside the physics module) so gtaPhysics stays
// pure and unit-testable with no DOM.
export interface DriveInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
}

// A seat's live position on the stage, in stage-local pixels. Supplied by the
// caller from DOM rects (the same measurement ThrowOverlay does) so the
// physics module never touches the DOM itself.
export interface SeatBox {
  id: string;
  x: number; // center, stage-local px
  y: number; // center, stage-local px
  w: number;
  h: number;
  // False for an obstacle the car should drive straight through while still
  // registering a hit -- e.g. a player already run over this round. Defaults
  // to true (every existing obstacle is solid).
  solid?: boolean;
}

// Table damage, synced under RTDB `gtaTable/$roomCode` so every client in the
// room sees the same cracks/split/wasted state -- previously this all lived
// in SeatTable's own useState, so a hit one person's browser detected was
// invisible to everyone else's.
//
// Cracks are push-keyed one-shot children (like ThrowEvent under `throws`)
// rather than one mutable node holding an array: two drivers ramming the
// table within the same tick would otherwise race a read-modify-write of a
// single array field, and one of their cracks would silently vanish. Push
// keys make every crack its own independent write -- no read needed, no
// race possible, and ordering doesn't matter since cracks only ever
// accumulate.
export interface TableCrackEvent {
  id: string; // RTDB push key, attached client-side from snap.key
  fx: number; // 0..1, local to whichever surface it landed on (see `side`)
  fy: number;
  rot: number; // decal rotation, degrees
  side: 'table' | 'left' | 'right';
  fromUid: string; // who caused it, matching the throws/gta ownership pattern
  ts: number;
}

// Each split piece's cumulative shove, keyed by side rather than push-keyed
// like cracks: unlike a crack (an independent, order-irrelevant event), a
// piece's position is a running total that every subsequent hit must build
// on top of, so it needs to be one mutable value clients converge on -- the
// same shape roomStore.gta.ts's position node uses for a driver's car.
export interface TablePieceMove {
  x: number;
  y: number;
  rot: number;
}

// uid -> true for every player run over this round. A plain boolean map
// (not push-keyed) because "is this uid wasted" only has two states and
// only ever flips one way per round -- there's nothing to accumulate or
// order, unlike cracks.
export type WastedMap = Record<string, true>;
