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
