// The paper aeroplane's flight path.
//
// Kept as pure functions over plain numbers, with no DOM and no React, so the
// curve can be sampled and asserted directly in a unit test -- the geometry is
// the part that was wrong twice, and it's much easier to check as maths than
// as a rendered animation.
//
// Why this isn't CSS keyframes like every other weapon: keyframes interpolate
// linearly between stops, so N waypoints describe an N-sided polygon, not a
// curve. The direction of travel changes instantly at each stop, which reads
// as a series of small jerks however many stops you add. A cubic bezier
// sampled per frame has continuous curvature, so there are no corners at all.

export interface Point {
  x: number;
  y: number;
}

export interface FlightPose {
  x: number;
  y: number;
  /** Degrees. Heading along the path, plus bank into the turn. */
  angle: number;
  scale: number;
}

/** Lateral swing as a fraction of throw distance, capped for very long throws. */
const SWING_RATIO = 0.16;
const SWING_MAX = 58;
/** Apex lift, also proportional -- a short lob shouldn't climb as far as a long throw. */
const LIFT_RATIO = 0.22;
const LIFT_MAX = 76;
/** Scale at launch and at the target. Ends below 1: the plane is flying away. */
const SCALE_START = 0.55;
const SCALE_END = 0.82;
/** Peak bank angle, degrees, reached where the path curves hardest. */
const BANK_MAX = 26;

/**
 * Four beats -- launch, climb, hang, dive -- as a continuous remapping of
 * linear time onto path position.
 *
 * A custom curve rather than a stock easing because the shape is specific:
 * fast off the hand, a slow float through the apex (the part that sells
 * "paper"), then an accelerating dive.
 */
export function glideEase(t: number): number {
  // Built by integrating a speed profile rather than by joining two power
  // curves at the apex. Two pieces that each flatten out where they meet drive
  // the speed to zero at the seam -- the plane stops dead mid-air for a frame
  // and then sets off again, which is a worse artifact than the waypoint
  // corners this rebuild set out to remove. A hang should be *slow*, not
  // stationary.
  //
  // The profile: fast off the hand, easing to a slow (but non-zero) float
  // through the apex, then accelerating into the dive. Because it's the
  // integral of a continuous, strictly positive function, both position and
  // speed are smooth everywhere and the plane never stalls or reverses.
  const clamped = Math.min(1, Math.max(0, t));
  return speedIntegral(clamped) / SPEED_TOTAL;
}

/** Relative speed at time `u`. Strictly positive, so progress never stalls. */
function glideSpeed(u: number): number {
  // Launch surge decaying away, a constant floor that keeps the apex moving,
  // and a dive term that builds through the back half.
  const launch = 2.6 * Math.exp(-5.5 * u);
  const float = 0.42;
  const dive = 2.5 * Math.pow(u, 2.4);
  return launch + float + dive;
}

/** Simpson's rule over the speed profile: exact enough at this resolution. */
function integrateSpeed(to: number, steps = 64): number {
  if (to <= 0) return 0;
  const h = to / steps;
  let sum = glideSpeed(0) + glideSpeed(to);
  for (let i = 1; i < steps; i++) {
    sum += glideSpeed(i * h) * (i % 2 === 0 ? 2 : 4);
  }
  return (sum * h) / 3;
}

// Precomputed once: the curve is fixed, so there's no reason to integrate it
// on every frame of every throw.
const SPEED_SAMPLES = 256;
const SPEED_TABLE: number[] = Array.from({ length: SPEED_SAMPLES + 1 }, (_, i) =>
  integrateSpeed(i / SPEED_SAMPLES),
);
const SPEED_TOTAL = SPEED_TABLE[SPEED_SAMPLES];

/** Linear lookup into the precomputed integral. */
function speedIntegral(u: number): number {
  const x = u * SPEED_SAMPLES;
  const i = Math.min(SPEED_SAMPLES - 1, Math.floor(x));
  const frac = x - i;
  return SPEED_TABLE[i] + (SPEED_TABLE[i + 1] - SPEED_TABLE[i]) * frac;
}

/**
 * The flight path as a cubic bezier.
 *
 * Control points are offset perpendicular to the straight line between the
 * seats, which is what makes the plane arc out and curl back rather than fly
 * straight. Both the sideways swing and the upward lift are fractions of the
 * throw's own length, so a short lob and a long cross-table throw arc in
 * proportion instead of one looking enormous and the other invisible.
 */
export function glideControlPoints(from: Point, to: Point): [Point, Point, Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const swing = Math.min(SWING_MAX, dist * SWING_RATIO);
  const lift = Math.min(LIFT_MAX, dist * LIFT_RATIO);

  // The arc is built from two separate ingredients, because they answer two
  // different questions and tying them together is what made near-vertical
  // throws misbehave.
  //
  // Lift is simply "up the screen". A plane climbs and then descends; that is
  // true whichever way it was thrown, so lift must not be derived from the
  // throw's direction at all.
  //
  // Swing is the sideways S-curve, and it needs a side to swing towards. The
  // obvious choice -- the perpendicular (-dy, dx), flipped to point upwards --
  // is unstable exactly when the throw is vertical: dx is then near zero, so
  // its sign is decided by a pixel or two, and clicking the left rather than
  // the right half of the same avatar mirrors the whole arc. The plane then
  // sets off away from its target before curling back, which reads as flying
  // backwards.
  //
  // So the side is chosen by horizontal travel where there is some, and falls
  // back to a fixed side for a straight-up-or-down throw. `sideWeight` fades
  // the swing out as the throw approaches vertical, so the transition through
  // that fallback is gradual rather than a jump: a dead-vertical throw arcs
  // almost purely on lift, which looks right and, more importantly, looks the
  // same wherever on the avatar you clicked.
  const horizontal = Math.abs(dx) / dist;
  const sideWeight = Math.min(1, horizontal / 0.35);
  const side = dx >= 0 ? 1 : -1;
  // Perpendicular to the path, oriented to the chosen side.
  const px = (-dy / dist) * side;
  const py = (dx / dist) * side;

  // Lift also eases off as the throw approaches vertical. Straight up or down,
  // "climb" points along the flight path rather than across it, so a large
  // lift there stops bending the curve and starts doubling it back on itself:
  // the plane covers ground, stalls, and covers it again, which is the very
  // stutter this rebuild exists to remove. A vertical throw is short on
  // screen anyway, so a shallower arc suits it.
  const liftWeight = 0.4 + 0.6 * sideWeight;
  const bend = swing * sideWeight;
  const c1: Point = {
    x: from.x + dx * 0.28 + px * bend,
    y: from.y + dy * 0.28 + py * bend - lift * 1.5 * liftWeight,
  };
  // c2 crosses back towards the line but stays out and stays high, so the
  // curve leans over the apex before dropping -- this gives the dive
  // somewhere to fall from.
  const c2: Point = {
    x: from.x + dx * 0.72 + px * bend * 0.34,
    y: from.y + dy * 0.72 + py * bend * 0.34 - lift * 1.15 * liftWeight,
  };
  return [from, c1, c2, to];
}

function bezierAt(p: [Point, Point, Point, Point], t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x,
    y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y,
  };
}

/** First derivative -- the velocity vector, which is where the plane points. */
function bezierTangentAt(p: [Point, Point, Point, Point], t: number): Point {
  const u = 1 - t;
  const a = 3 * u * u;
  const b = 6 * u * t;
  const c = 3 * t * t;
  return {
    x: a * (p[1].x - p[0].x) + b * (p[2].x - p[1].x) + c * (p[3].x - p[2].x),
    y: a * (p[1].y - p[0].y) + b * (p[2].y - p[1].y) + c * (p[3].y - p[2].y),
  };
}

/**
 * The plane's full pose at linear time `t` (0..1).
 *
 * Attitude is derived from the tangent rather than authored per-waypoint, so
 * the plane always points along the path it's actually flying, and the bank
 * follows the curvature -- it leans into a turn because it is turning. The
 * previous keyframe version hand-set seven rotation values, the last of which
 * jumped backwards to meet the impact animation, producing a visible flick on
 * arrival.
 */
export function glidePose(from: Point, to: Point, t: number): FlightPose {
  const clamped = Math.min(1, Math.max(0, t));
  const curve = glideControlPoints(from, to);
  const p = glideEase(clamped);
  const pos = bezierAt(curve, p);
  const tan = bezierTangentAt(curve, p);
  const heading = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;

  // Bank peaks mid-flight and washes out at both ends: wings level off the
  // hand, hard over through the turn, pulling flat as it comes in. sin gives
  // that shape with continuous derivatives, so the roll has no seams either.
  const bank = -Math.sin(p * Math.PI) * BANK_MAX;

  // Monotonic, and ends below 1. The old version ran .45 -> 1.15, so the plane
  // grew two and a half times while flying away from the viewer.
  const scale = SCALE_START + (SCALE_END - SCALE_START) * p;

  return { x: pos.x, y: pos.y, angle: heading + bank, scale };
}
