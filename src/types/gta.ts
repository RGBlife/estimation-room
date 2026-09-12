// Live car positions and table effects delivered by the room connection.
export interface DriverState {
  uid: string; // Server-authenticated participant identity
  x: number; // 0..1 fraction of stage width
  y: number; // 0..1 fraction of stage height
  r: number; // rotation, radians
  t: number; // ms timestamp, for staleness and interpolation
  // Set for the one frame a hard collision lands, naming who was hit. Rides
  // along on the position payload rather than getting its own event --
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

// Individual impacts have server-issued IDs, preserving simultaneous hits.
export interface TableCrackEvent {
  id: string; // live push key, attached client-side from snap.key
  fx: number; // 0..1, local to whichever surface it landed on (see `side`)
  fy: number;
  rot: number; // decal rotation, degrees
  side: 'table' | 'left' | 'right';
  fromUid: string; // who caused it, matching the throws/gta ownership pattern
  ts: number;
}

// Cumulative position of one table piece.
export interface TablePieceMove {
  x: number;
  y: number;
  rot: number;
}

// Participant IDs marked as hit this round.
export type WastedMap = Record<string, true>;
