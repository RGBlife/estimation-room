import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import CarWithRider from './CarShape.tsx';
import { createCar, stepCar, CAR_W, CAR_H } from './gtaPhysics.ts';
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

type StyleVars = React.CSSProperties & Record<string, string | number>;

interface RemoteCarProps {
  driver: DriverState;
  stageBox: { w: number; h: number };
  color: string;
  avatarUrl: string | undefined;
}

function RemoteCar({ driver, stageBox, color, avatarUrl }: RemoteCarProps) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: driver.x * stageBox.w,
        top: driver.y * stageBox.h,
        width: CAR_W,
        height: CAR_H,
        transform: `translate(-50%, -50%) rotate(${driver.r}rad)`,
        // Remote cars aren't hand-off animated (arriving/exploding) -- they
        // simply appear/disappear with the RTDB node, which is the simplest
        // thing that reads correctly for a viewer who wasn't driving. The
        // squash itself plays on whatever it hit (a seat's own avatar, via
        // onSeatSquash), not on this car -- ramming something doesn't flatten
        // the car doing the ramming.
        transition: 'left 60ms linear, top 60ms linear, transform 60ms linear',
      }}
    >
      <CarWithRider color={color} avatarUrl={avatarUrl} />
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
  // `drivers` only starts once actually driving, and network latency would
  // otherwise leave the seat's own avatar visible (duplicated alongside the
  // car) for however long that write takes to land.
  onSeatVacatedChange: (vacated: boolean) => void;
  onExit: () => void;
}

// Renders GTA Mode inside the real room: the local player's fully-animated
// car (entry, driving, explosion, return -- same lifecycle as the offline
// sandbox) plus every other driver's live-streamed car. Local physics runs
// against both real seat boxes and other drivers' current positions, so cars
// can ram each other as well as the furniture.
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

  const [, forceRender] = useState(0);
  const [phase, setPhase] = useState<GtaPhase>('idle');
  const [hintVisible, setHintVisible] = useState(false);
  const [hintClosing, setHintClosing] = useState(false);
  const [wreck, setWreck] = useState<{ x: number; y: number } | null>(null);

  const debris = debrisPieces();
  const smoke = smokePuffs();
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
    let startX = sb.width / 2;
    let startY = sb.height / 2;
    if (seatNode) {
      const b = seatNode.getBoundingClientRect();
      startX = Math.min(b.left + b.width / 2 - sb.left + 80, sb.width - CAR_W);
      startY = Math.min(Math.max(b.top + b.height / 2 - sb.top + 34, CAR_H), sb.height - CAR_H);
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
  // not wait on the RTDB round-trip (drivers[uid] only appears once actually
  // driving), or the seat's own avatar stays visibly duplicated alongside
  // the car for however long that write takes to land.
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
    for (const id of obstacleIds) {
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
    for (const d of remoteDriversRef.current) {
      out.push({
        id: `driver:${d.uid}`,
        x: d.x * stageBox.width,
        y: d.y * stageBox.height,
        w: CAR_W,
        h: CAR_H,
      });
    }
    return out;
  };

  useLayoutEffect(() => {
    const loop = (now: number) => {
      if (stageNode && isDriveable(phaseRef.current)) {
        const box = stageNode.getBoundingClientRect();
        const prev = lastRef.current || now;
        const dt = Math.min(0.05, (now - prev) / 1000);
        lastRef.current = now;
        const obstacles = measureObstacles(box);
        const out = stepCar(carRef.current, inputRef.current, dt, { w: box.width, h: box.height }, obstacles);
        carRef.current = out.car;
        for (const id of out.bumpedIds) if (!id.startsWith('driver:')) onSeatBump(id);
        // A driver-vs-driver hit only reports our own uid via the RTDB
        // payload -- the other side detects the same collision independently
        // from their own stepCar call, so it doesn't need relaying.
        const hitSeatId = out.hitId && !out.hitId.startsWith('driver:') ? out.hitId : null;
        if (hitSeatId?.startsWith('__table') && out.hitPoint) {
          // Shove direction: straight out from the car's center through the
          // contact point -- simpler and just as physically sensible as
          // deriving it from velocity, and always well-defined even for a
          // near head-on hit where the velocity vector alone would be noisy.
          const dx = out.hitPoint.x - out.car.x;
          const dy = out.hitPoint.y - out.car.y;
          const mag = Math.hypot(dx, dy) || 1;
          onTableHit(hitSeatId, out.hitPoint.x, out.hitPoint.y, dx / mag, dy / mag);
        } else if (hitSeatId) {
          onSeatSquash(hitSeatId);
        }
        onPublish({
          x: box.width > 0 ? out.car.x / box.width : 0,
          y: box.height > 0 ? out.car.y / box.height : 0,
          r: out.car.r,
          t: Date.now(),
          hit: out.hitId?.startsWith('driver:') ? out.hitId.slice('driver:'.length) : null,
        });
        forceRender(n => (n + 1) % 1000000);
      } else {
        lastRef.current = now;
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

  // Anyone else's car ramming the driver ends their round too -- being hit
  // reads as "you got wrecked," not a no-op.
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
      {stageBox && otherDrivers.map(d => (
        <RemoteCar
          key={d.uid}
          driver={d}
          stageBox={{ w: stageBox.width, h: stageBox.height }}
          color={CAR_COLORS[colorIndexForUid(d.uid) % CAR_COLORS.length]}
          avatarUrl={getAvatarForUid(d.uid)}
        />
      ))}

      {active && (
        <>
          {hasCar(phase) && (
            <div
              className="absolute"
              style={{
                left: car.x, top: car.y, width: CAR_W, height: CAR_H,
                transform: `translate(-50%, -50%) rotate(${car.r}rad)`,
              }}
            >
              <div
                style={{
                  width: CAR_W, height: CAR_H,
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

          {phase === 'exploding' && wreck && (
            <>
              {/* Inner hot flash + outer shock ring -- two rings staggered by
                  a short delay read as an actual blast, not one ring fading. */}
              <div
                className="absolute rounded-full border-solid border-[#fff3d6]"
                style={{
                  left: wreck.x, top: wreck.y, width: 46, height: 46,
                  marginLeft: -23, marginTop: -23,
                  animation: `sp-gta-blast ${EXPLODE_MS * 0.7}ms ease-out both`,
                }}
              />
              <div
                className="absolute rounded-full border-solid border-[#ffca7a]"
                style={{
                  left: wreck.x, top: wreck.y, width: 70, height: 70,
                  marginLeft: -35, marginTop: -35,
                  animation: `sp-gta-blast ${EXPLODE_MS}ms ease-out 60ms both`,
                }}
              />
              {debris.map((d, i) => {
                const big = i % 3 === 0;
                const size = big ? 11 : 7;
                return (
                  <div
                    key={i}
                    className="absolute rounded-[2px] bg-[#ffb347]"
                    style={{
                      left: wreck.x, top: wreck.y, width: size, height: size,
                      marginLeft: -size / 2, marginTop: -size / 2,
                      '--fx': `${d.fx}px`, '--fy': `${d.fy}px`, '--fr': `${d.fr}deg`,
                      animation: `sp-gta-debris ${EXPLODE_MS + (big ? 200 : 0)}ms ease-out ${d.delay}ms both`,
                    } as StyleVars}
                  />
                );
              })}
              {smoke.map((s, i) => (
                <div
                  key={`smoke-${i}`}
                  className="absolute rounded-full bg-[#6b6862]"
                  style={{
                    left: wreck.x, top: wreck.y, width: 22, height: 22,
                    marginLeft: -11, marginTop: -11,
                    '--sx': `${s.sx}px`, '--sy': `${s.sy}px`, '--sr': s.sr,
                    animation: `sp-gta-smoke ${EXPLODE_MS + 500}ms ease-out ${s.delay}ms both`,
                  } as StyleVars}
                />
              ))}
            </>
          )}

          {phase === 'returning' && wreck && (
            <div
              className="absolute"
              style={{
                left: wreck.x, top: wreck.y,
                marginLeft: -SEAT_SIZE_FALLBACK / 2, marginTop: -SEAT_SIZE_FALLBACK / 2,
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
                style={{ width: SEAT_SIZE_FALLBACK, height: SEAT_SIZE_FALLBACK }}
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
