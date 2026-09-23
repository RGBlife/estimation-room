import { beforeEach, expect, it } from 'vitest';
import { INTERP_DELAY_MS, driverPoseAt, forgetAllDrivers, lastDriverArrival, recordDriverSample } from './remoteDriverSamples.ts';

beforeEach(() => forgetAllDrivers());

it('draws a car between the two samples either side of the delayed moment', () => {
  recordDriverSample('a', { x: 0, y: 0, r: 0 }, 1000);
  recordDriverSample('a', { x: 1, y: .5, r: 0 }, 1100);
  const pose = driverPoseAt('a', 1050 + INTERP_DELAY_MS)!;
  expect(pose.x).toBeCloseTo(.5);
  expect(pose.y).toBeCloseTo(.25);
});

it('holds the newest pose once past the last sample, and the oldest before the first', () => {
  recordDriverSample('a', { x: .2, y: .2, r: 0 }, 1000);
  recordDriverSample('a', { x: .4, y: .4, r: 0 }, 1100);
  expect(driverPoseAt('a', 5000)).toEqual({ x: .4, y: .4, r: 0 });
  expect(driverPoseAt('a', 900)).toEqual({ x: .2, y: .2, r: 0 });
});

it('turns the short way round when the heading wraps', () => {
  recordDriverSample('a', { x: 0, y: 0, r: Math.PI - .1 }, 1000);
  recordDriverSample('a', { x: 0, y: 0, r: -Math.PI + .1 }, 1100);
  expect(driverPoseAt('a', 1050 + INTERP_DELAY_MS)!.r).toBeCloseTo(Math.PI);
});

it('counts a repeated parked pose as a sign of life, and sets off promptly after a pause', () => {
  recordDriverSample('a', { x: .1, y: .1, r: 0 }, 1000);
  recordDriverSample('a', { x: .1, y: .1, r: 0 }, 2000);
  expect(lastDriverArrival('a')).toBe(2000);
  recordDriverSample('a', { x: .3, y: .1, r: 0 }, 2050);
  // Still parked until just before the move, then sets off at once rather
  // than creeping across the whole second it sat still.
  expect(driverPoseAt('a', 1900 + INTERP_DELAY_MS)!.x).toBeCloseTo(.1);
  expect(driverPoseAt('a', 2025 + INTERP_DELAY_MS)!.x).toBeCloseTo(.2);
});

it('knows nothing about a driver it has never heard from', () => {
  expect(driverPoseAt('nobody')).toBeNull();
  expect(lastDriverArrival('nobody')).toBeNull();
});

it('keeps a steady pace when network jitter bunches samples together', () => {
  // Sent every 50ms from a clock 1,000,000ms away from ours; the second
  // sample is held up and lands right before the third.
  const skew = 1_000_000;
  recordDriverSample('a', { x: 0, y: 0, r: 0, t: skew + 0 }, 20);
  recordDriverSample('a', { x: .1, y: 0, r: 0, t: skew + 50 }, 115);
  recordDriverSample('a', { x: .2, y: 0, r: 0, t: skew + 100 }, 120);
  // Placed on the sender's timeline (offset = the smallest delay, 20ms), the
  // car covers equal distance in equal time despite the bunched arrivals.
  const at = (sent: number) => driverPoseAt('a', sent + 20 + INTERP_DELAY_MS)!.x;
  expect(at(25)).toBeCloseTo(.05);
  expect(at(50)).toBeCloseTo(.1);
  expect(at(75)).toBeCloseTo(.15);
});
