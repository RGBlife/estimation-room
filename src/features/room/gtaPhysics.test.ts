import { describe, it, expect } from 'vitest';
import { createCar, stepCar, speedOf, SQUASH_SPEED, MAX_SPEED } from './gtaPhysics.ts';
import type { DriveInput, SeatBox } from '../../types/gta.ts';

const NONE: DriveInput = { forward: false, back: false, left: false, right: false };
const GO: DriveInput = { ...NONE, forward: true };
const BOUNDS = { w: 800, h: 400 };

function drive(car = createCar(400, 200), input = GO, steps = 60, seats: SeatBox[] = []) {
  let state = car;
  const hits: string[] = [];
  let bumps: string[] = [];
  for (let i = 0; i < steps; i++) {
    const out = stepCar(state, input, 1 / 60, BOUNDS, seats);
    state = out.car;
    if (out.hitId) hits.push(out.hitId);
    bumps = bumps.concat(out.bumpedIds);
  }
  return { car: state, hits, bumps };
}

describe('stepCar movement', () => {
  it('accelerates forward along its heading', () => {
    const { car } = drive(createCar(400, 200, 0), GO, 30);
    expect(car.x).toBeGreaterThan(400);
    expect(Math.abs(car.y - 200)).toBeLessThan(1);
  });

  it('coasts to a near-stop when input is released', () => {
    const { car } = drive(createCar(400, 200, 0), GO, 30);
    const moving = speedOf(car);
    expect(moving).toBeGreaterThan(50);
    const { car: rested } = drive(car, NONE, 300);
    expect(speedOf(rested)).toBeLessThan(moving * 0.05);
  });

  it('never exceeds MAX_SPEED however long you hold forward', () => {
    const { car } = drive(createCar(400, 200, 0), GO, 2000);
    expect(speedOf(car)).toBeLessThanOrEqual(MAX_SPEED + 1);
  });

  it('does not spin on the spot when parked', () => {
    const { car } = drive(createCar(400, 200, 0), { ...NONE, left: true }, 60);
    expect(Math.abs(car.r)).toBeLessThan(0.01);
  });

  it('steers once actually moving', () => {
    const { car } = drive(createCar(400, 200, 0), { ...GO, left: true }, 60);
    expect(Math.abs(car.r)).toBeGreaterThan(0.1);
  });
});

describe('bounds', () => {
  it('keeps the car on the stage when driven at a wall', () => {
    // Aim right, drive far longer than it takes to cross the board.
    const { car } = drive(createCar(700, 200, 0), GO, 600);
    expect(car.x).toBeLessThanOrEqual(BOUNDS.w);
    expect(car.x).toBeGreaterThanOrEqual(0);
  });

  it('keeps the car in bounds from every heading', () => {
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7, -2.1]) {
      const { car } = drive(createCar(400, 200, r), GO, 600);
      expect(car.x).toBeGreaterThanOrEqual(0);
      expect(car.x).toBeLessThanOrEqual(BOUNDS.w);
      expect(car.y).toBeGreaterThanOrEqual(0);
      expect(car.y).toBeLessThanOrEqual(BOUNDS.h);
    }
  });
});

describe('collisions', () => {
  const seat = (id: string, x: number, y: number): SeatBox => ({ id, x, y, w: 52, h: 52 });

  it('reports a bump when the car reaches a seat', () => {
    const { bumps } = drive(createCar(300, 200, 0), GO, 90, [seat('alice', 420, 200)]);
    expect(bumps).toContain('alice');
  });

  it('does not report seats it never touches', () => {
    const { bumps } = drive(createCar(300, 200, 0), GO, 60, [seat('bob', 300, 40)]);
    expect(bumps).not.toContain('bob');
  });

  it('bounces off a seat rather than passing through it', () => {
    // Long enough that an un-blocked car would be well past the seat.
    const { car } = drive(createCar(300, 200, 0), GO, 200, [seat('alice', 460, 200)]);
    expect(car.x).toBeLessThan(460);
  });

  it('flags a squash only above the speed threshold', () => {
    // Slow nudge: start adjacent so it contacts before building speed.
    const slow = drive(createCar(390, 200, 0), GO, 6, [seat('alice', 440, 200)]);
    expect(slow.hits).toHaveLength(0);
    // Full run-up from across the board.
    const fast = drive(createCar(120, 200, 0), GO, 120, [seat('alice', 600, 200)]);
    expect(fast.hits).toContain('alice');
  });

  it('only squashes at or above SQUASH_SPEED', () => {
    let state = createCar(120, 200, 0);
    const seats = [seat('alice', 600, 200)];
    for (let i = 0; i < 200; i++) {
      const speedBefore = speedOf(state);
      const out = stepCar(state, GO, 1 / 60, BOUNDS, seats);
      if (out.hitId) {
        // The impact speed that triggered it must clear the bar.
        expect(Math.max(speedBefore, speedOf(out.car))).toBeGreaterThanOrEqual(SQUASH_SPEED * 0.9);
      }
      state = out.car;
    }
  });
});

describe('stability', () => {
  it('produces finite values under a large dt spike', () => {
    const out = stepCar(createCar(400, 200, 0), GO, 0.25, BOUNDS, []);
    expect(Number.isFinite(out.car.x)).toBe(true);
    expect(Number.isFinite(out.car.y)).toBe(true);
    expect(Number.isFinite(out.car.vx)).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    const a = drive(createCar(200, 200, 0.3), GO, 120, [{ id: 's', x: 500, y: 210, w: 52, h: 52 }]);
    const b = drive(createCar(200, 200, 0.3), GO, 120, [{ id: 's', x: 500, y: 210, w: 52, h: 52 }]);
    expect(a.car).toEqual(b.car);
    expect(a.hits).toEqual(b.hits);
  });
});

describe('large obstacles (the table)', () => {
  // The table is far bigger than a seat, which is the case most likely to
  // expose a weakness in the closest-point collision test.
  const table: SeatBox = { id: '__table__', x: 400, y: 200, w: 440, h: 130 };

  it('blocks a car driven straight at it', () => {
    const { car } = drive(createCar(80, 200, 0), GO, 300, [table]);
    expect(car.x).toBeLessThan(table.x - table.w / 2 + 5);
  });

  it('cannot be tunnelled through at full speed from any side', () => {
    const approaches: Array<[number, number, number]> = [
      [80, 200, 0],            // from the left
      [720, 200, Math.PI],     // from the right
      [400, 30, Math.PI / 2],  // from above
      [400, 370, -Math.PI / 2],// from below
    ];
    for (const [x, y, r] of approaches) {
      const { car } = drive(createCar(x, y, r), GO, 400, [table]);
      const insideX = Math.abs(car.x - table.x) < table.w / 2 - 4;
      const insideY = Math.abs(car.y - table.y) < table.h / 2 - 4;
      expect(insideX && insideY).toBe(false);
    }
  });

  it('reports the table as bumped on contact', () => {
    const { bumps } = drive(createCar(80, 200, 0), GO, 300, [table]);
    expect(bumps).toContain('__table__');
  });
});
