// The GTA Mode lifecycle, as a pure state machine. Kept free of React and the
// DOM for the same reason gtaPhysics.ts is: the phase ordering and the
// timings are the part most likely to break subtly, and they are far easier
// to pin down in a unit test than by watching animations.
//
//   idle -> arriving -> boarding -> driving -> exploding -> returning -> idle
//
// arriving/boarding play once when the driver enters; exploding/returning
// play once when the round resets. Only `driving` accepts input, and only
// `driving` publishes position -- which is what keeps a round reset from
// streaming a car that is mid-explosion.

export type GtaPhase =
  | 'idle'
  | 'arriving'
  | 'boarding'
  | 'driving'
  | 'exploding'
  | 'returning';

// Durations in ms. These are the source of truth: the CSS animations are
// authored to match, and the sandbox/overlay read them from here rather than
// hard-coding their own copies.
export const ARRIVE_MS = 620;
export const BOARD_MS = 520;
export const EXPLODE_MS = 700;
export const RETURN_MS = 900;

// How long the "arrow keys to move" hint stays up before fading, and how
// long the fade itself takes. Matches the weapon tip's fade so the two
// affordances feel like the same product.
export const HINT_MS = 4200;
export const HINT_FADE_MS = 600;

export function isDriveable(phase: GtaPhase): boolean {
  return phase === 'driving';
}

// True while the car should be rendered at all.
export function hasCar(phase: GtaPhase): boolean {
  return phase === 'arriving' || phase === 'boarding' || phase === 'driving' || phase === 'exploding';
}

// True while the player's own seat should read as empty (they're in the
// car). Boarding is deliberately excluded -- the rider is shown wobbling in
// their seat right up until driving starts, which is the moment they
// actually leave it (see GtaOverlay's boarding/driving handoff).
export function seatVacated(phase: GtaPhase): boolean {
  return phase === 'driving' || phase === 'exploding' || phase === 'returning';
}

// The phase that follows `phase` once its animation finishes, or null when
// the phase waits on something other than a timer (driving waits on the
// round ending; idle waits on the player pressing the button).
export function nextPhase(phase: GtaPhase): GtaPhase | null {
  switch (phase) {
    case 'arriving': return 'boarding';
    case 'boarding': return 'driving';
    case 'exploding': return 'returning';
    case 'returning': return 'idle';
    default: return null;
  }
}

// How long `phase` lasts, for phases that advance on a timer.
export function phaseDuration(phase: GtaPhase): number | null {
  switch (phase) {
    case 'arriving': return ARRIVE_MS;
    case 'boarding': return BOARD_MS;
    case 'exploding': return EXPLODE_MS;
    case 'returning': return RETURN_MS;
    default: return null;
  }
}

// Debris fragments for the explosion. Deterministic given a count, so both
// the driver and remote viewers can render the same blast without syncing
// anything -- the same reason FRAG_ANGLES in weapons.ts is a fixed list.
export interface Debris {
  fx: number;
  fy: number;
  fr: number;
  delay: number;
}

export function debrisPieces(count = 9): Debris[] {
  const out: Debris[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = 34 + (i % 3) * 16;
    out.push({
      fx: Math.round(Math.cos(angle) * dist),
      fy: Math.round(Math.sin(angle) * dist),
      fr: Math.round(((i % 2 === 0 ? 1 : -1) * (180 + i * 40))),
      delay: (i % 4) * 26,
    });
  }
  return out;
}

// Smoke puffs for the explosion's aftermath, deterministic for the same
// reason debrisPieces is -- both the driver and remote viewers (once the
// explosion is streamed) must render the same cloud with no sync needed.
export interface SmokePuff {
  sx: number;
  sy: number;
  sr: number;
  delay: number;
}

export function smokePuffs(count = 5): SmokePuff[] {
  const out: SmokePuff[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.4;
    const dist = 18 + (i % 3) * 10;
    out.push({
      sx: Math.round(Math.cos(angle) * dist),
      sy: Math.round(Math.sin(angle) * dist - 14 - (i % 3) * 6), // drifts upward
      sr: 2 + (i % 3) * 0.6,
      delay: 80 + (i % 4) * 70,
    });
  }
  return out;
}
