import { describe, it, expect } from 'vitest';
import { glidePose, glideEase, glideControlPoints } from './glideFlight.ts';

// The flight has now been rebuilt twice, both times because the plane moved in
// ways nobody noticed until it was on screen: first flying backwards out of
// the hand, then jerking between waypoints. Sampling the path frame by frame
// is the check that catches that class of bug as maths, before it renders.

/** Poses at 60fps across the whole flight, the way the rAF loop would emit them. */
function sampleFlight(from: { x: number; y: number }, to: { x: number; y: number }, frames = 60) {
  return Array.from({ length: frames + 1 }, (_, i) => glidePose(from, to, i / frames));
}

const LONG = { from: { x: 40, y: 300 }, to: { x: 451, y: 300 } };
const SHORT = { from: { x: 200, y: 210 }, to: { x: 260, y: 289 } };

describe('glideEase', () => {
  it('starts at the start and ends at the end', () => {
    expect(glideEase(0)).toBeCloseTo(0, 5);
    expect(glideEase(1)).toBeCloseTo(1, 5);
  });

  it('never goes backwards', () => {
    // The original flight's most visible bug: the plane briefly travelled away
    // from its target before lurching forward again.
    let prev = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const p = glideEase(i / 200);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('is ahead of linear early and hangs at the apex', () => {
    // Fast off the hand...
    expect(glideEase(0.25)).toBeGreaterThan(0.25);
    // ...then genuinely slow through the middle: the "hang" that reads as
    // paper rather than as a thrown rock. Distance covered over the 0.35-0.55
    // window should be well under what linear time would give.
    const hangDistance = glideEase(0.55) - glideEase(0.35);
    expect(hangDistance).toBeLessThan(0.16);
  });

  it('accelerates into the target', () => {
    // The dive is the last beat, and it should be the fastest part of the
    // flight -- more ground covered in the final fifth than in the fifth
    // before it.
    const beforeDive = glideEase(0.8) - glideEase(0.6);
    const dive = glideEase(1) - glideEase(0.8);
    expect(dive).toBeGreaterThan(beforeDive);
  });
});

describe('glideControlPoints', () => {
  // Perpendicular distance of the first control point from the straight line,
  // as a fraction of the throw's length.
  const offsetRatio = (f: { x: number; y: number }, t: { x: number; y: number }) => {
    const [, c1] = glideControlPoints(f, t);
    const dist = Math.hypot(t.x - f.x, t.y - f.y);
    const px = -(t.y - f.y) / dist;
    const py = (t.x - f.x) / dist;
    return Math.abs((c1.x - f.x) * px + (c1.y - f.y) * py) / dist;
  };

  it('arcs in proportion to the distance thrown, below the caps', () => {
    // A short lob and a medium throw should look like the same manoeuvre at
    // different sizes, not one enormous arc and one flat line.
    const short = offsetRatio({ x: 0, y: 0 }, { x: 90, y: 40 });
    const medium = offsetRatio({ x: 0, y: 0 }, { x: 180, y: 80 });
    expect(short).toBeCloseTo(medium, 2);
  });

  it('caps the arc so a very long throw does not swing absurdly wide', () => {
    // Past the cap the arc stops growing with distance, which is the point of
    // having one -- so the ratio falls away rather than holding constant.
    const medium = offsetRatio({ x: 0, y: 0 }, { x: 180, y: 80 });
    const veryLong = offsetRatio({ x: 0, y: 0 }, { x: 900, y: 0 });
    expect(veryLong).toBeLessThan(medium);
  });

  it('does not divide by zero when a seat throws at itself', () => {
    const pose = glidePose({ x: 100, y: 100 }, { x: 100, y: 100 }, 0.5);
    expect(Number.isFinite(pose.x)).toBe(true);
    expect(Number.isFinite(pose.y)).toBe(true);
    expect(Number.isFinite(pose.angle)).toBe(true);
  });
});

// A near-vertical throw is the awkward case: the arc's "side" has to come from
// somewhere, and horizontal travel -- the obvious source -- is almost nothing.
// An earlier version took the sign of that near-zero number, so clicking the
// left rather than the right half of the same avatar mirrored the entire arc
// and sent the plane out backwards before it curled around to its target.
describe('a near-vertical throw', () => {
  const NORTH = { x: 640, y: 170 };
  const SOUTH = { x: 640, y: 600 };
  const AVATAR_W = 56;

  /** Target point for a click `offsetX` of the way across the target avatar. */
  const clickAt = (offsetX: number) => ({ x: SOUTH.x + offsetX * AVATAR_W, y: SOUTH.y });

  /** How far the path strays sideways from the thrower's column, signed. */
  const maxSideways = (offsetX: number) => {
    const target = clickAt(offsetX);
    let worst = 0;
    for (let i = 0; i <= 90; i++) {
      const p = glidePose(NORTH, target, i / 90);
      if (Math.abs(p.x - NORTH.x) > Math.abs(worst)) worst = p.x - NORTH.x;
    }
    return worst;
  };

  it('does not mirror the arc between two nearly-identical clicks', () => {
    // The bug: these two targets are 5.6px apart, and the arc flipped from one
    // side of the table to the other between them.
    const justLeft = maxSideways(-0.05);
    const justRight = maxSideways(0.05);
    expect(Math.abs(justLeft - justRight)).toBeLessThan(12);
  });

  it('varies smoothly across the whole face of the target', () => {
    // Sweeping the click from one edge to the other should move the arc a
    // little at a time, with no jump anywhere in between.
    const sweep = Array.from({ length: 41 }, (_, i) => maxSideways(-0.5 + i * 0.025));
    for (let i = 1; i < sweep.length; i++) {
      expect(Math.abs(sweep[i] - sweep[i - 1])).toBeLessThan(6);
    }
  });

  it('never flies away from the target, wherever it is clicked', () => {
    // What "backwards" actually looked like: the plane setting off in the
    // wrong direction before curling back.
    for (const offsetX of [-0.5, -0.25, -0.05, 0, 0.05, 0.25, 0.5]) {
      const target = clickAt(offsetX);
      let prev = Infinity;
      for (let i = 0; i <= 90; i++) {
        const p = glidePose(NORTH, target, i / 90);
        const d = Math.hypot(target.x - p.x, target.y - p.y);
        expect(d, `moved away from the target at t=${(i / 90).toFixed(2)}, click ${offsetX}`).toBeLessThanOrEqual(prev + 0.001);
        prev = d;
      }
    }
  });

  it('still arcs, rather than flying dead straight', () => {
    const target = clickAt(0);
    let peak = 0;
    for (let i = 0; i <= 90; i++) {
      const p = glidePose(NORTH, target, i / 90);
      const lineY = NORTH.y + (target.y - NORTH.y) * (i / 90);
      peak = Math.max(peak, lineY - p.y);
    }
    expect(peak).toBeGreaterThan(20);
  });
});

// Every direction a seat can throw in. The arc is built from a perpendicular
// and a lift, and both have historically behaved differently depending on
// which way the throw pointed -- sagging under the table one way and arcing
// over it the other.
describe.each([
  ['west to east', { x: 200, y: 400 }, { x: 900, y: 400 }],
  ['east to west', { x: 900, y: 400 }, { x: 200, y: 400 }],
  ['north to south', { x: 640, y: 170 }, { x: 640, y: 600 }],
  ['south to north', { x: 640, y: 600 }, { x: 640, y: 170 }],
  ['north-east to south-west', { x: 900, y: 180 }, { x: 250, y: 610 }],
  ['north-west to south-east', { x: 250, y: 180 }, { x: 900, y: 610 }],
])('a throw heading %s', (_label, from, to) => {
  it('arcs above the straight line rather than sagging below it', () => {
    let peak = 0;
    for (let i = 0; i <= 90; i++) {
      const p = glidePose(from, to, i / 90);
      const lineY = from.y + (to.y - from.y) * (i / 90);
      peak = Math.max(peak, lineY - p.y);
    }
    expect(peak).toBeGreaterThan(15);
  });

  it('closes on the target the whole way', () => {
    let prev = Infinity;
    for (let i = 0; i <= 90; i++) {
      const p = glidePose(from, to, i / 90);
      const d = Math.hypot(to.x - p.x, to.y - p.y);
      expect(d).toBeLessThanOrEqual(prev + 0.001);
      prev = d;
    }
  });

  it('holds a steady speed with no stutter', () => {
    const poses = Array.from({ length: 91 }, (_, i) => glidePose(from, to, i / 90));
    const steps = poses.slice(1).map((p, i) => Math.hypot(p.x - poses[i].x, p.y - poses[i].y));
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1];
      const b = steps[i];
      if (a < 0.01 && b < 0.01) continue;
      expect(Math.max(a, b) / Math.max(0.01, Math.min(a, b))).toBeLessThan(1.35);
    }
  });
});

describe.each([
  ['a long cross-table throw', LONG],
  ['a short lob', SHORT],
])('glidePose over %s', (_label, { from, to }) => {
  it('starts at the thrower and lands on the target', () => {
    const start = glidePose(from, to, 0);
    const end = glidePose(from, to, 1);
    expect(start.x).toBeCloseTo(from.x, 3);
    expect(start.y).toBeCloseTo(from.y, 3);
    expect(end.x).toBeCloseTo(to.x, 3);
    expect(end.y).toBeCloseTo(to.y, 3);
  });

  it('closes on the target on every single frame', () => {
    // The assertion the previous rebuild was verified against, kept as a test
    // so it can't silently regress a third time.
    const poses = sampleFlight(from, to);
    let prev = Infinity;
    for (const p of poses) {
      const d = Math.hypot(to.x - p.x, to.y - p.y);
      expect(d).toBeLessThanOrEqual(prev + 0.001);
      prev = d;
    }
  });

  it('never jerks: no frame moves disproportionately far', () => {
    // A corner in the path shows up as one frame's step being wildly larger
    // than its neighbours'. With continuous curvature, consecutive steps
    // should stay within a modest ratio of each other.
    const poses = sampleFlight(from, to);
    const steps = poses.slice(1).map((p, i) => Math.hypot(p.x - poses[i].x, p.y - poses[i].y));
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1];
      const b = steps[i];
      if (a < 0.01 && b < 0.01) continue;
      expect(Math.max(a, b) / Math.max(0.01, Math.min(a, b))).toBeLessThan(1.6);
    }
  });

  it('never snaps its attitude between frames', () => {
    // The old keyframes pitched to +20deg at 90% then jumped back to +6deg at
    // 100% to meet the impact, which read as a flick right as it arrived.
    //
    // Measured from t=0.05: the first couple of frames are the launch attitude
    // settling while the plane is still on the thrower's seat and fading in
    // from transparent, so a large change there is both expected and invisible.
    const poses = sampleFlight(from, to);
    for (let i = Math.ceil(poses.length * 0.05); i < poses.length; i++) {
      let delta = Math.abs(poses[i].angle - poses[i - 1].angle);
      if (delta > 180) delta = 360 - delta; // across the atan2 wrap
      expect(delta).toBeLessThan(12);
    }
  });

  it('points along the path it is actually flying', () => {
    // Attitude is derived from the tangent, so heading should track the
    // direction of travel rather than being authored independently of it.
    const poses = sampleFlight(from, to, 120);
    for (let i = 1; i < poses.length; i++) {
      const travel = (Math.atan2(poses[i].y - poses[i - 1].y, poses[i].x - poses[i - 1].x) * 180) / Math.PI;
      let off = Math.abs(poses[i].angle - travel);
      if (off > 180) off = 360 - off;
      // Bank is layered on top of heading, so allow for it but not for the
      // plane flying sideways or backwards.
      expect(off).toBeLessThan(40);
    }
  });

  it('grows monotonically and never ends up larger than life', () => {
    // The old flight ended on scale(1.15) after starting at .45 -- the plane
    // ballooned while flying away from the viewer, purely to match the shared
    // impact animation's opening frame.
    const poses = sampleFlight(from, to);
    let prev = -Infinity;
    for (const p of poses) {
      expect(p.scale).toBeGreaterThanOrEqual(prev);
      prev = p.scale;
    }
    expect(poses[poses.length - 1].scale).toBeLessThan(1);
  });

  it('lifts above the straight line at the apex', () => {
    // Without this the "arc" could satisfy every smoothness check above by
    // being a flat line.
    const poses = sampleFlight(from, to);
    const apex = poses[Math.round(poses.length * 0.5)];
    const lineY = from.y + (to.y - from.y) * 0.5;
    expect(apex.y).toBeLessThan(lineY);
  });
});
