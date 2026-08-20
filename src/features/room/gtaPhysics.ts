import type { DriveInput, SeatBox } from '../../types/gta.ts';

// Pure car simulation for GTA Mode. Deliberately free of React, Firebase and
// the DOM: the caller measures seat rects and feeds them in, and gets back
// plain numbers. That keeps this module unit-testable in jsdom without a
// canvas or a running room, which is where the collision/spring-back rules
// are pinned down.
//
// This is a hand-rolled arcade model rather than a matter.js world. The board
// is a handful of axis-aligned boxes and one car, so a full rigid-body engine
// would be ~905KB of dependency to resolve collisions we can express in a few
// lines -- and matter.js's own step is not deterministic across machines,
// which would work against the convergence rules the sync design relies on.
// matter.js stays out of the bundle entirely.

// Tuned in the offline sandbox (?visual-test=gta), where iterating is free.
export const ACCEL = 900; // px/s^2 while holding forward
export const REVERSE_ACCEL = 520;
export const DRAG = 2.4; // per-second velocity decay
export const MAX_SPEED = 620; // px/s
export const TURN_RATE = 3.2; // rad/s at full speed
export const BOUNCE = 0.45; // velocity retained when hitting something
// Sized to actually contain a rider: an avatar is ~52px, so the body must be
// comfortably larger than that in both axes or the car reads as a toy next to
// the person supposedly driving it.
export const CAR_W = 96;
export const CAR_H = 58;

// A collision only counts as a "squash" above this closing speed, so drifting
// gently into someone just nudges them. Phase 2 reads this.
export const SQUASH_SPEED = 260;

export interface CarState {
  x: number; // stage-local px, center
  y: number;
  vx: number; // px/s
  vy: number;
  r: number; // heading, radians
}

export interface StepResult {
  car: CarState;
  // uid of a seat squashed hard enough this step, if any.
  hitId: string | null;
  // The actual point of contact for hitId, in the same stage-local px as the
  // input seats -- the closest point on the hit box to the car's center, NOT
  // the car's own center, which for a wide obstacle like the table can sit
  // well inside or outside its edge depending on approach angle.
  hitPoint: { x: number; y: number } | null;
  // Seats bumped this step at any speed, for the wobble animation.
  bumpedIds: string[];
}

export function createCar(x: number, y: number, r = 0): CarState {
  return { x, y, vx: 0, vy: 0, r };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Axis-aligned overlap test against the car's bounding circle. The car is a
// rotating rectangle; a circle keeps the collision response stable at speed
// and avoids per-frame SAT for a body this simple. The radius follows the
// *shorter* half-extent -- inscribed rather than enclosing -- because an
// enclosing circle on a long car would stop it a visible gap short of
// whatever it drove into.
const CAR_RADIUS = Math.min(CAR_W, CAR_H) / 2;

function overlap(car: CarState, seat: SeatBox): { nx: number; ny: number; depth: number; px: number; py: number } | null {
  // Closest point on the seat box to the car center.
  const halfW = seat.w / 2;
  const halfH = seat.h / 2;
  const cx = clamp(car.x, seat.x - halfW, seat.x + halfW);
  const cy = clamp(car.y, seat.y - halfH, seat.y + halfH);
  const dx = car.x - cx;
  const dy = car.y - cy;
  const distSq = dx * dx + dy * dy;
  if (distSq >= CAR_RADIUS * CAR_RADIUS) return null;
  const dist = Math.sqrt(distSq);
  // Dead center: push straight up rather than dividing by zero.
  if (dist === 0) return { nx: 0, ny: -1, depth: CAR_RADIUS, px: cx, py: cy };
  return { nx: dx / dist, ny: dy / dist, depth: CAR_RADIUS - dist, px: cx, py: cy };
}

export function speedOf(car: CarState): number {
  return Math.hypot(car.vx, car.vy);
}

// Advances the car one step. `dt` is in seconds and is clamped by the caller
// (see useGtaMode) so a backgrounded tab resuming after a long pause can't
// tunnel the car through the whole board in one giant step.
export function stepCar(
  car: CarState,
  input: DriveInput,
  dt: number,
  bounds: { w: number; h: number },
  seats: SeatBox[],
): StepResult {
  const next: CarState = { ...car };

  // Steering scales with how fast you're actually going -- a parked car
  // shouldn't spin on the spot.
  const speed = speedOf(next);
  const steerAuthority = Math.min(1, speed / 120);
  if (input.left) next.r -= TURN_RATE * steerAuthority * dt;
  if (input.right) next.r += TURN_RATE * steerAuthority * dt;

  if (input.forward) {
    next.vx += Math.cos(next.r) * ACCEL * dt;
    next.vy += Math.sin(next.r) * ACCEL * dt;
  }
  if (input.back) {
    next.vx -= Math.cos(next.r) * REVERSE_ACCEL * dt;
    next.vy -= Math.sin(next.r) * REVERSE_ACCEL * dt;
  }

  const decay = Math.max(0, 1 - DRAG * dt);
  next.vx *= decay;
  next.vy *= decay;

  const newSpeed = speedOf(next);
  if (newSpeed > MAX_SPEED) {
    const scale = MAX_SPEED / newSpeed;
    next.vx *= scale;
    next.vy *= scale;
  }

  next.x += next.vx * dt;
  next.y += next.vy * dt;

  // Seat collisions. Speed is sampled before the bounce so the squash test
  // reflects how hard the car was actually travelling on impact.
  const impactSpeed = speedOf(next);
  const bumpedIds: string[] = [];
  let hitId: string | null = null;
  let hitPoint: { x: number; y: number } | null = null;
  for (const seat of seats) {
    const hit = overlap(next, seat);
    if (!hit) continue;
    bumpedIds.push(seat.id);
    if (impactSpeed >= SQUASH_SPEED && hitId === null) {
      hitId = seat.id;
      hitPoint = { x: hit.px, y: hit.py };
    }
    // A non-solid obstacle (e.g. someone already wasted this round) still
    // registers the hit above but doesn't block the car -- driving over
    // them again shouldn't stop you dead.
    if (seat.solid === false) continue;
    // Push the car back out along the contact normal and reflect its velocity.
    next.x += hit.nx * hit.depth;
    next.y += hit.ny * hit.depth;
    const dot = next.vx * hit.nx + next.vy * hit.ny;
    next.vx = (next.vx - 2 * dot * hit.nx) * BOUNCE;
    next.vy = (next.vy - 2 * dot * hit.ny) * BOUNCE;
  }

  // Stage walls. Keeps the car on the board no matter what, which also means
  // the streamed 0..1 fractions can never go out of range.
  const half = CAR_RADIUS;
  if (next.x < half) { next.x = half; next.vx = Math.abs(next.vx) * BOUNCE; }
  if (next.x > bounds.w - half) { next.x = bounds.w - half; next.vx = -Math.abs(next.vx) * BOUNCE; }
  if (next.y < half) { next.y = half; next.vy = Math.abs(next.vy) * BOUNCE; }
  if (next.y > bounds.h - half) { next.y = bounds.h - half; next.vy = -Math.abs(next.vy) * BOUNCE; }

  return { car: next, hitId, hitPoint, bumpedIds };
}
