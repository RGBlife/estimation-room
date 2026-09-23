import type { DriverState } from '../../types/gta.ts';

// Recent position samples per remote driver. Both room adapters feed this as
// updates arrive; GtaOverlay reads it every animation frame to draw each
// remote car slightly in the past, interpolating between the two samples
// either side of that moment.
//
// Drawing the newest sample directly (the previous approach, eased by a CSS
// transition) stutters: samples leave the driver ~every 50ms but arrive with
// network jitter, so the transition either finishes early and the car stops,
// or is cut short and the car jumps. Rendering INTERP_DELAY_MS behind leaves
// a sample on both sides of almost every frame.
//
// Samples are placed on the *sender's* timeline (their `t`), shifted onto
// this machine's clock by the smallest delay seen so far. Placing them by
// arrival time instead would copy the network's jitter into the motion --
// two samples arriving close together made the car sprint, then crawl. Only
// differences between one sender's own timestamps matter, so the two
// machines' clocks never have to agree. Lives outside React so a sample
// landing never costs a render; only the store's batched update does.

export const INTERP_DELAY_MS = 110;
const KEEP_MS = 1000;
const MAX_SAMPLES = 32;
// Drivers publish at most every 50ms, and a parked one re-sends its pose once
// a second. A gap past RESUME_GAP_MS is a pause, not network jitter.
const PUBLISH_INTERVAL_MS = 50;
const RESUME_GAP_MS = 400;

interface Sample { t: number; x: number; y: number; r: number }
interface Track { samples: Sample[]; offset: number; lastArrival: number }

const tracks = new Map<string, Track>();

export function recordDriverSample(uid: string, driver: Pick<DriverState, 'x' | 'y' | 'r'> & { t?: number }, arrival = performance.now()): void {
  // Without a usable sender timestamp, fall back to the arrival time.
  const sent = typeof driver.t === 'number' && Number.isFinite(driver.t) ? driver.t : null;
  let track = tracks.get(uid);
  if (!track) {
    track = { samples: [], offset: sent == null ? 0 : arrival - sent, lastArrival: arrival };
    tracks.set(uid, track);
  }
  track.lastArrival = arrival;
  const t = sent ?? arrival - track.offset;
  // The least-delayed sample is the best estimate of the clock offset.
  if (sent != null) track.offset = Math.min(track.offset, arrival - sent);
  const list = track.samples;
  const prev = list[list.length - 1];
  if (prev && t <= prev.t) return; // stale or duplicated delivery
  // A repeat of the same pose (a keep-alive while parked) carries no motion,
  // and recording it would stretch the gap the next real move interpolates
  // across.
  if (prev && prev.x === driver.x && prev.y === driver.y && prev.r === driver.r) return;
  // Moving off after a pause: without this the car would creep across the
  // whole pause instead of setting off when it actually did. Re-anchor the
  // parked pose one publish interval before the new one.
  if (prev && t - prev.t > RESUME_GAP_MS) list.push({ ...prev, t: t - PUBLISH_INTERVAL_MS });
  list.push({ t, x: driver.x, y: driver.y, r: driver.r });
  while (list.length > MAX_SAMPLES || (list.length > 2 && t - list[0].t > KEEP_MS)) list.shift();
}

export function forgetDriver(uid: string): void {
  tracks.delete(uid);
}

export function forgetAllDrivers(): void {
  tracks.clear();
}

// Local time the most recent update from this driver arrived, or null if none
// has (e.g. fixture drivers in the dev harness, which never go stale).
export function lastDriverArrival(uid: string): number | null {
  return tracks.get(uid)?.lastArrival ?? null;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Interpolated pose (0..1 stage fractions, radians) for local time `now`, or
// null when nothing has been recorded for this driver.
export function driverPoseAt(uid: string, now = performance.now()): { x: number; y: number; r: number } | null {
  const track = tracks.get(uid);
  if (!track || track.samples.length === 0) return null;
  const list = track.samples;
  // The same moment, on the sender's timeline.
  const target = now - INTERP_DELAY_MS - track.offset;
  const first = list[0];
  if (target <= first.t) return { x: first.x, y: first.y, r: first.r };
  for (let i = list.length - 1; i > 0; i--) {
    const a = list[i - 1];
    const b = list[i];
    if (target >= a.t) {
      if (target >= b.t) return { x: b.x, y: b.y, r: b.r };
      const k = (target - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, r: lerpAngle(a.r, b.r, k) };
    }
  }
  const last = list[list.length - 1];
  return { x: last.x, y: last.y, r: last.r };
}
