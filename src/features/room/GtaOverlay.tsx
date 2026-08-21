import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import CarWithRider from './CarShape.tsx';
import { createCar, stepCar, carSize, CAR_W, CAR_H } from './gtaPhysics.ts';
import {
  nextPhase, phaseDuration, isDriveable, hasCar, seatVacated, debrisPieces, smokePuffs,
  ARRIVE_MS, BOARD_MS, EXPLODE_MS, RETURN_MS, HINT_MS, HINT_FADE_MS,
  type GtaPhase,
} from './gtaLifecycle.ts';
import type { CarState } from './gtaPhysics.ts';
import type { DriveInput, SeatBox, DriverState } from '../../types/gta.ts';

// Distinct car colors per driver, cycled by join order -- otherwise every car
// on the board is the same red as the sandbox's, and two drivers colliding
// is unreadable. Kept short; SEAT_COUNT-scale rooms will repeat a color, but
// a repeat only ever matters if two same-colored cars are on screen together.
const CAR_COLORS = ['#e5484d', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

const SEAT_SIZE_FALLBACK = 52;
// How long a remote driver's node is kept without a fresh update before it's
// treated as gone -- covers a dropped final write (e.g. a crash that beat
// onDisconnect) without leaving a ghost car parked on the board forever.
const REMOTE_STALE_MS = 4000;

// The stage width the car/physics constants in gtaPhysics.ts are tuned at.
// A narrower stage (phone-width board) scales the car down proportionally so
// it still reads sized-right next to the seats/table rather than towering
// over a shrunk board -- floored so the kart never gets so small the rider
// inside it is unreadable.
const CAR_SCALE_REF_WIDTH = 720;
const CAR_SCALE_MIN = 0.62;

function carScaleFor(stageWidth: number): number {
  if (stageWidth <= 0) return 1;
  return Math.min(1, Math.max(CAR_SCALE_MIN, stageWidth / CAR_SCALE_REF_WIDTH));
}

type StyleVars = React.CSSProperties & Record<string, string | number>;

// The blast: two staggered rings, tumbling debris, and drifting smoke,
// centered on (x, y). Shared between the local driver's own explosion and a
// remote driver's (via RemoteCar) -- debris/smoke are deterministic (see
// debrisPieces/smokePuffs in gtaLifecycle.ts), so no synced data is needed
// beyond "this driver is exploding, here" to render an identical blast on
// every client.
//
// `scale` shrinks the whole blast radius/piece sizes to match a smaller car
// on a smaller board (see carScaleFor) -- a full-size explosion on a
// phone-width table would visually swallow half the seats.
function ExplosionEffect({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const debris = debrisPieces();
  const smoke = smokePuffs();
  return (
    <>
      {/* Inner hot flash + outer shock ring -- two rings staggered by a
          short delay read as an actual blast, not one ring fading. */}
      <div
        className="absolute rounded-full border-solid border-[#fff3d6]"
        style={{
          left: x, top: y, width: 46 * scale, height: 46 * scale,
          marginLeft: (-23) * scale, marginTop: (-23) * scale,
          animation: `sp-gta-blast ${EXPLODE_MS * 0.7}ms ease-out both`,
        }}
      />
      <div
        className="absolute rounded-full border-solid border-[#ffca7a]"
        style={{
          left: x, top: y, width: 70 * scale, height: 70 * scale,
          marginLeft: (-35) * scale, marginTop: (-35) * scale,
          animation: `sp-gta-blast ${EXPLODE_MS}ms ease-out 60ms both`,
        }}
      />
      {debris.map((d, i) => {
        const big = i % 3 === 0;
        const size = (big ? 11 : 7) * scale;
        return (
          <div
            key={i}
            className="absolute rounded-[2px] bg-[#ffb347]"
            style={{
              left: x, top: y, width: size, height: size,
              marginLeft: -size / 2, marginTop: -size / 2,
              '--fx': `${d.fx * scale}px`, '--fy': `${d.fy * scale}px`, '--fr': `${d.fr}deg`,
              animation: `sp-gta-debris ${EXPLODE_MS + (big ? 200 : 0)}ms ease-out ${d.delay}ms both`,
            } as StyleVars}
          />
        );
      })}
      {smoke.map((s, i) => {
        const size = 22 * scale;
        return (
          <div
            key={`smoke-${i}`}
            className="absolute rounded-full bg-[#6b6862]"
            style={{
              left: x, top: y, width: size, height: size,
              marginLeft: -size / 2, marginTop: -size / 2,
              '--sx': `${s.sx * scale}px`, '--sy': `${s.sy * scale}px`, '--sr': s.sr,
              animation: `sp-gta-smoke ${EXPLODE_MS + 500}ms ease-out ${s.delay}ms both`,
            } as StyleVars}
          />
        );
      })}
    </>
  );
}

interface RemoteCarProps {
  driver: DriverState;
  stageBox: { w: number; h: number };
  color: string;
  avatarUrl: string | undefined;
  seatNode: HTMLElement | null;
  stageNode: HTMLElement;
}

// Renders another driver's car for every phase they're in, not just
// 'driving' -- position/heading now stream continuously through the whole
// lifecycle (see roomStore.gta.ts), so there's always a fresh x/y/r to work
// from even while the car is stationary (arriving/boarding/exploding).
//
// arriving/boarding are deliberately simplified next to the local driver's
// own treatment: we don't know a remote car's actual off-stage entry point
// (sp-gta-arrive's travel distance is computed from the local seat's DOM
// position, which only the driver's own client measures), so a remote
// arrival is just a fade+scale-in in place rather than a matching flight
// path. It's the brief phase and the least important one to get exactly
// right; exploding/returning (the two phases everyone actually watches
// happen) reuse the same animations as the local driver's own.
function RemoteCar({ driver, stageBox, color, avatarUrl, seatNode, stageNode }: RemoteCarProps) {
  const x = driver.x * stageBox.w;
  const y = driver.y * stageBox.h;
  const phase = driver.phase as GtaPhase;
  const scale = carScaleFor(stageBox.w);
  const { w: carW, h: carH } = carSize(scale);
  const seatSize = SEAT_SIZE_FALLBACK * scale;

  if (phase === 'exploding') {
    return <ExplosionEffect x={x} y={y} scale={scale} />;
  }

  if (phase === 'returning') {
    const sb = stageNode.getBoundingClientRect();
    const seatHome = (() => {
      if (!seatNode) return { dx: 0, dy: 0, arc: 46 };
      const b = seatNode.getBoundingClientRect();
      const dx = b.left + b.width / 2 - sb.left - x;
      const dy = b.top + b.height / 2 - sb.top - y;
      const midY = y + dy * 0.5;
      return { dx, dy, arc: Math.max(12, Math.min(46, midY - 10)) };
    })();
    return (
      <div
        className="absolute"
        style={{
          left: x, top: y,
          marginLeft: -seatSize / 2, marginTop: -seatSize / 2,
          '--sp-gta-back-x': `${seatHome.dx}px`,
          '--sp-gta-back-y': `${seatHome.dy}px`,
          '--sp-gta-arc': `${seatHome.arc}px`,
          animation: `sp-gta-eject ${RETURN_MS}ms cubic-bezier(.3,.6,.3,1) both`,
        } as StyleVars}
      >
        <img
          src={avatarUrl}
          alt=""
          className="block rounded-full border border-sp-border bg-sp-card-bg"
          style={{ width: seatSize, height: seatSize }}
        />
      </div>
    );
  }

  return (
    <div
      className="absolute"
      style={{
        left: x, top: y, width: carW, height: carH,
        transform: `translate(-50%, -50%) rotate(${driver.r}rad)`,
        // Interpolates smoothly between throttled position samples while
        // driving; harmless during arriving/boarding since the car barely
        // moves in those phases anyway.
        transition: 'left 60ms linear, top 60ms linear, transform 60ms linear',
        animation: phase === 'arriving' ? 'sp-gta-remote-arrive 200ms ease both' : undefined,
      }}
    >
      <CarWithRider
        color={color}
        w={carW}
        h={carH}
        // Matches the local driver's own hand-off: empty through arriving
        // and boarding, visible once actually driving.
        avatarUrl={phase === 'arriving' || phase === 'boarding' ? undefined : avatarUrl}
      />
    </div>
  );
}

interface GtaOverlayProps {
  active: boolean;
  // Set true to make an in-progress drive end gracefully (explosion +
  // return-to-seat) instead of the RTDB stream being cut instantly -- used
  // when the round resets out from under a driver.
  forceEnd: boolean;
  driverUid: string;
  driverAvatarUrl: string | undefined;
  colorIndex: number;
  remoteDrivers: DriverState[];
  getAvatarForUid: (uid: string) => string | undefined;
  colorIndexForUid: (uid: string) => number;
  // Every seat/observer uid on the board, so the car collides with all of
  // them -- plus the synthetic '__table__' id, mirroring GtaSandbox's own
  // table-as-obstacle treatment.
  obstacleIds: string[];
  // uids already run over this round -- their seat still registers a hit
  // (so it can be squashed again for the visual feedback) but stops
  // physically blocking the car.
  wastedIds: Set<string>;
  getSeatNode: (uid: string) => HTMLElement | null;
  stageNode: HTMLElement | null;
  onPublish: (state: Omit<DriverState, 'uid'>) => void;
  // Reports every seat this car bumps/squashes so the caller can animate the
  // seat's own avatar -- this overlay only draws cars, never touches seat
  // DOM directly, since SeatTable already owns every seat node.
  onSeatBump: (seatId: string) => void;
  onSeatSquash: (seatId: string) => void;
  // Reports a hit on the table (or, once split, on one of its two separate
  // pieces -- '__table__left'/'__table__right', each its own obstacle) at
  // the car's impact point in stage-local px. The caller converts to that
  // piece's own local coordinates since it owns the DOM rect, to place a
  // crack decal and shove the piece itself further from the impact.
  onTableHit: (tableId: string, stageX: number, stageY: number, impactDx: number, impactDy: number) => void;
  // Fires the instant the local phase crosses into/out of seatVacated --
  // driven straight off local state, not the RTDB round-trip. Publishing to
  // `drivers` now starts as soon as 'arriving' begins (not just once
  // driving), so this still can't be derived from drivers[uid] existing --
  // a remote viewer keys their own equivalent read off driver.phase instead
  // (see SeatTable.tsx), which is why phase rides along on every sample.
  onSeatVacatedChange: (vacated: boolean) => void;
  onExit: () => void;
}

// Renders GTA Mode inside the real room: the local player's fully-animated
// car (entry, driving, explosion, return -- same lifecycle as the offline
// sandbox) plus every other driver's live-streamed car, each rendered
// through that same lifecycle rather than just an interpolated dot. Local
// physics runs against both real seat boxes and other drivers' current
// positions, so cars can ram each other as well as the furniture.
export default function GtaOverlay({
  active, forceEnd, driverUid, driverAvatarUrl, colorIndex, remoteDrivers, getAvatarForUid, colorIndexForUid,
  obstacleIds, wastedIds, getSeatNode, stageNode, onPublish, onSeatBump, onSeatSquash, onTableHit,
  onSeatVacatedChange, onExit,
}: GtaOverlayProps) {
  const inputRef = useRef<DriveInput>({ forward: false, back: false, left: false, right: false });
  const carRef = useRef<CarState>(createCar(0, 0));
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const phaseRef = useRef<GtaPhase>('idle');
  const remoteDriversRef = useRef<DriverState[]>(remoteDrivers);
  remoteDriversRef.current = remoteDrivers;
  const wastedIdsRef = useRef<Set<string>>(wastedIds);
  wastedIdsRef.current = wastedIds;
  // Same stale-closure guard as the two above, and load-bearing for the same
  // reason: the rAF loop below is set up once (deps: [stageNode]), so reading
  // the obstacleIds prop directly would freeze the obstacle list at whatever
  // it was when the overlay mounted. That mattered the moment the table
  // gained its split -- the id list changes mid-drive from ['__table__'] to
  // the two piece ids, and without this the running drive would keep
  // colliding with the intact table it can no longer see.
  const obstacleIdsRef = useRef<string[]>(obstacleIds);
  obstacleIdsRef.current = obstacleIds;

  const [, forceRender] = useState(0);
  const [phase, setPhase] = useState<GtaPhase>('idle');
  const [hintVisible, setHintVisible] = useState(false);
  const [hintClosing, setHintClosing] = useState(false);
  const [wreck, setWreck] = useState<{ x: number; y: number } | null>(null);

  const color = CAR_COLORS[colorIndex % CAR_COLORS.length];

  const setPhaseBoth = (p: GtaPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // Kicks off the entry sequence exactly once, when this overlay becomes
  // active -- 'active' flips true the instant the driver presses the button.
  useEffect(() => {
    if (!active) return;
    const stage = stageNode;
    const seatNode = getSeatNode(driverUid);
    if (!stage) return;
    const sb = stage.getBoundingClientRect();
    const { w: carW, h: carH } = carSize(carScaleFor(sb.width));
    let startX = sb.width / 2;
    let startY = sb.height / 2;
    if (seatNode) {
      const b = seatNode.getBoundingClientRect();
      startX = Math.min(b.left + b.width / 2 - sb.left + 80 * (carW / CAR_W), sb.width - carW);
      startY = Math.min(Math.max(b.top + b.height / 2 - sb.top + 34 * (carH / CAR_H), carH), sb.height - carH);
    }
    carRef.current = createCar(startX, startY, Math.PI);
    setWreck(null);
    setPhaseBoth('arriving');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    const ms = phaseDuration(phase);
    const next = nextPhase(phase);
    if (ms == null || next == null) return;
    const t = setTimeout(() => setPhaseBoth(next), ms);
    return () => clearTimeout(t);
  }, [phase]);

  // Once fully returned, hand control back to the caller so it can hide this
  // overlay and stop the RTDB write loop.
  useEffect(() => {
    if (phase === 'idle' && wreck) onExit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Boarding: the rider wobbles in their seat (the same reaction a bump
  // gets) right up until driving starts, at which point the seat empties and
  // the car's own rider becomes visible -- see seatVacated and hasCar in
  // gtaLifecycle.ts, and the CarWithRider avatarUrl condition below.
  useEffect(() => {
    if (phase === 'boarding') onSeatBump(driverUid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Reports the vacated transition the instant it happens locally -- must
  // not wait on the RTDB round-trip, or the seat's own avatar stays visibly
  // duplicated alongside the car for however long that write takes to land.
  useEffect(() => {
    onSeatVacatedChange(seatVacated(phase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // If the overlay is torn down mid-sequence (shouldn't normally happen,
  // since onExit only fires once idle), make sure the seat isn't left
  // stuck invisible.
  useEffect(() => () => onSeatVacatedChange(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'driving') return;
    setHintVisible(true);
    setHintClosing(false);
    const fade = setTimeout(() => setHintClosing(true), HINT_MS);
    const gone = setTimeout(() => setHintVisible(false), HINT_MS + HINT_FADE_MS);
    return () => { clearTimeout(fade); clearTimeout(gone); };
  }, [phase]);

  useEffect(() => {
    if (!active) return;
    const set = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      const i = inputRef.current;
      if (k === 'arrowup' || k === 'w') i.forward = down;
      else if (k === 'arrowdown' || k === 's') i.back = down;
      else if (k === 'arrowleft' || k === 'a') i.left = down;
      else if (k === 'arrowright' || k === 'd') i.right = down;
      else return;
      e.preventDefault();
      if (down) setHintClosing(true);
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      inputRef.current = { forward: false, back: false, left: false, right: false };
    };
  }, [active]);

  const measureObstacles = (stageBox: { width: number; height: number }): SeatBox[] => {
    if (!stageNode) return [];
    const sb = stageNode.getBoundingClientRect();
    const out: SeatBox[] = [];
    for (const id of obstacleIdsRef.current) {
      // The driver isn't in their seat while driving, so it stops being an
      // obstacle -- otherwise the car collides with the chair it came from.
      if (id === driverUid && seatVacated(phaseRef.current)) continue;
      const node = getSeatNode(id);
      if (!node) continue;
      const b = node.getBoundingClientRect();
      out.push({
        id, x: b.left + b.width / 2 - sb.left, y: b.top + b.height / 2 - sb.top, w: b.width, h: b.height,
        solid: !wastedIdsRef.current.has(id),
      });
    }
    // Other drivers' current cars are obstacles too, so cars can ram each
    // other -- represented as boxes the same shape stepCar already handles.
    // Only while they're actually driving: a remote car mid-explosion or
    // mid-return isn't a solid thing to collide with on the board anymore.
    const { w: carW, h: carH } = carSize(carScaleFor(stageBox.width));
    for (const d of remoteDriversRef.current) {
      if (d.phase !== 'driving') continue;
      out.push({
        id: `driver:${d.uid}`,
        x: d.x * stageBox.width,
        y: d.y * stageBox.height,
        w: carW,
        h: carH,
      });
    }
    return out;
  };

  useLayoutEffect(() => {
    const loop = (now: number) => {
      const stageBoxNow = stageNode?.getBoundingClientRect();
      // Set only the one frame a driver-vs-driver hit lands, then published
      // once below and forgotten -- transient by construction, same as it
      // always was, just no longer folded into the branch that's gated on
      // isDriveable (publish now happens every frame regardless of phase).
      let hitDriverUid: string | null = null;
      if (stageBoxNow && isDriveable(phaseRef.current)) {
        const prev = lastRef.current || now;
        const dt = Math.min(0.05, (now - prev) / 1000);
        lastRef.current = now;
        const obstacles = measureObstacles(stageBoxNow);
        const scale = carScaleFor(stageBoxNow.width);
        const out = stepCar(carRef.current, inputRef.current, dt, { w: stageBoxNow.width, h: stageBoxNow.height }, obstacles, scale);
        carRef.current = out.car;
        for (const id of out.bumpedIds) if (!id.startsWith('driver:')) onSeatBump(id);
        if (out.hitId?.startsWith('driver:')) {
          // A driver-vs-driver hit only reports our own uid via the RTDB
          // payload -- the other side detects the same collision
          // independently from their own stepCar call, so it doesn't need
          // relaying, only reporting who *we* hit.
          hitDriverUid = out.hitId.slice('driver:'.length);
        } else if (out.hitId?.startsWith('__table') && out.hitPoint) {
          // Shove direction: straight out from the car's center through the
          // contact point -- simpler and just as physically sensible as
          // deriving it from velocity, and always well-defined even for a
          // near head-on hit where the velocity vector alone would be noisy.
          const dx = out.hitPoint.x - out.car.x;
          const dy = out.hitPoint.y - out.car.y;
          const mag = Math.hypot(dx, dy) || 1;
          onTableHit(out.hitId, out.hitPoint.x, out.hitPoint.y, dx / mag, dy / mag);
        } else if (out.hitId) {
          onSeatSquash(out.hitId);
        }
        forceRender(n => (n + 1) % 1000000);
      } else {
        lastRef.current = now;
      }
      // Position (and phase) publish every frame regardless of whether the
      // car is actually moving this tick -- a remote viewer needs to see
      // arriving/boarding/exploding/returning play out too, not just
      // 'driving'. publishDriverState's own throttle (plus an immediate
      // bypass on phase change or a hit) keeps the actual write rate sane.
      if (stageBoxNow) {
        const car = carRef.current;
        onPublish({
          x: stageBoxNow.width > 0 ? car.x / stageBoxNow.width : 0,
          y: stageBoxNow.height > 0 ? car.y / stageBoxNow.height : 0,
          r: car.r,
          t: Date.now(),
          phase: phaseRef.current,
          hit: hitDriverUid,
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageNode]);

  const endRound = () => {
    setWreck({ x: carRef.current.x, y: carRef.current.y });
    inputRef.current = { forward: false, back: false, left: false, right: false };
    setPhaseBoth('exploding');
  };

  // Anyone else's car ramming us ends our round too -- being hit reads as
  // "you got wrecked," not a no-op. Each side detects the collision
  // independently from their own stepCar call (their car is one of our
  // `driver:`-prefixed obstacle boxes and vice versa); this effect is what
  // the *victim's* client watches for, keyed off the other driver's
  // transient `hit` field naming us (see the loop above).
  useEffect(() => {
    if (phase !== 'driving') return;
    const gotHit = remoteDrivers.some(d => d.hit === driverUid);
    if (gotHit) endRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteDrivers, phase]);

  // The room ending the round out from under a driver (someone reveals /
  // starts the next round) shouldn't cut them off mid-animation -- if
  // they're actively driving, send them through the same explosion/return
  // sequence the "End drive" button does. If they're already mid-sequence
  // (or never started), there's nothing to do; onExit fires naturally once
  // 'returning' completes.
  useEffect(() => {
    if (forceEnd && phase === 'driving') endRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceEnd]);

  const now = performance.now();
  const car = carRef.current;
  const stageBox = stageNode?.getBoundingClientRect();
  const scale = carScaleFor(stageBox?.width ?? 0);
  const { w: carW, h: carH } = carSize(scale);
  const seatSize = SEAT_SIZE_FALLBACK * scale;

  const seatHome = (() => {
    const node = getSeatNode(driverUid);
    if (!stageNode || !node || !wreck) return { dx: 0, dy: 0, arc: 46 };
    const sb = stageNode.getBoundingClientRect();
    const b = node.getBoundingClientRect();
    const dx = b.left + b.width / 2 - sb.left - wreck.x;
    const dy = b.top + b.height / 2 - sb.top - wreck.y;
    const midY = wreck.y + dy * 0.5;
    return { dx, dy, arc: Math.max(12, Math.min(46, midY - 10)) };
  })();

  const otherDrivers = remoteDrivers.filter(d => now - d.t < REMOTE_STALE_MS);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      style={{
        animation: phase === 'exploding' && wreck
          ? `sp-gta-impact-shake 380ms cubic-bezier(.2,.7,.3,1) both`
          : undefined,
      }}
    >
      {stageBox && stageNode && otherDrivers.map(d => (
        <RemoteCar
          key={d.uid}
          driver={d}
          stageBox={{ w: stageBox.width, h: stageBox.height }}
          color={CAR_COLORS[colorIndexForUid(d.uid) % CAR_COLORS.length]}
          avatarUrl={getAvatarForUid(d.uid)}
          seatNode={getSeatNode(d.uid)}
          stageNode={stageNode}
        />
      ))}

      {active && (
        <>
          {hasCar(phase) && (
            <div
              className="absolute"
              style={{
                left: car.x, top: car.y, width: carW, height: carH,
                transform: `translate(-50%, -50%) rotate(${car.r}rad)`,
              }}
            >
              <div
                style={{
                  width: carW, height: carH,
                  '--sp-gta-from-x': '160px', '--sp-gta-from-y': '-10px',
                  animation:
                    phase === 'arriving' ? `sp-gta-arrive ${ARRIVE_MS}ms cubic-bezier(.2,.9,.3,1) both`
                    : phase === 'exploding' ? `sp-gta-explode ${EXPLODE_MS}ms ease-out both`
                    : undefined,
                } as StyleVars}
              >
                <div
                  style={{
                    // The car rocks on its suspension as the rider climbs in
                    // -- sells the car itself as the thing being entered,
                    // not just a seat-side reaction that the car ignores.
                    animation: phase === 'boarding' ? `sp-gta-car-rock ${BOARD_MS}ms cubic-bezier(.3,.7,.3,1) both` : undefined,
                  }}
                >
                  <CarWithRider
                    color={color}
                    w={carW}
                    h={carH}
                    // Empty through arriving and boarding -- the rider is
                    // visibly still in their seat (wobbling) until the exact
                    // moment driving starts, which is when they actually
                    // leave it (see seatVacated in gtaLifecycle.ts).
                    avatarUrl={phase === 'arriving' || phase === 'boarding' ? undefined : driverAvatarUrl}
                  />
                </div>
              </div>
            </div>
          )}

          {phase === 'exploding' && wreck && <ExplosionEffect x={wreck.x} y={wreck.y} scale={scale} />}

          {phase === 'returning' && wreck && (
            <div
              className="absolute"
              style={{
                left: wreck.x, top: wreck.y,
                marginLeft: -seatSize / 2, marginTop: -seatSize / 2,
                '--sp-gta-back-x': `${seatHome.dx}px`,
                '--sp-gta-back-y': `${seatHome.dy}px`,
                '--sp-gta-arc': `${seatHome.arc}px`,
                animation: `sp-gta-eject ${RETURN_MS}ms cubic-bezier(.3,.6,.3,1) both`,
              } as StyleVars}
            >
              <img
                src={driverAvatarUrl}
                alt=""
                className="block rounded-full border border-sp-border bg-sp-card-bg"
                style={{ width: seatSize, height: seatSize }}
              />
            </div>
          )}

          {phase === 'driving' && (
            <div className="absolute right-4 bottom-4">
              <button
                onClick={endRound}
                className="pointer-events-auto cursor-pointer rounded border border-sp-border-strong bg-sp-panel-2 px-2.5 py-1.5 text-[11px] font-bold text-sp-text-dim"
              >End drive</button>
            </div>
          )}

          {hintVisible && (
            <div
              className="absolute bottom-4 left-1/2 flex items-center gap-2 rounded-[10px] border border-sp-accent-border bg-sp-accent-panel-2-transparent px-3.5 py-2 text-[12px] font-bold whitespace-nowrap text-sp-accent-text backdrop-blur-[6px]"
              style={{
                transform: 'translateX(-50%)',
                animation: `${hintClosing ? 'sp-tip-fade-out' : 'sp-tip-fade-in'} ${HINT_FADE_MS}ms ease both`,
              }}
            >
              <span className="font-sp-mono">← ↑ ↓ →</span>
              <span>or WASD to drive</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
