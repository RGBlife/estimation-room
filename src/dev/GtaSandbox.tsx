import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import CarWithRider from '../features/room/CarShape.tsx';
import { createCar, stepCar, speedOf, SQUASH_SPEED, MAX_SPEED, CAR_W, CAR_H } from '../features/room/gtaPhysics.ts';
import {
  nextPhase, phaseDuration, isDriveable, hasCar, seatVacated, debrisPieces,
  ARRIVE_MS, BOARD_MS, EXPLODE_MS, RETURN_MS, HINT_MS, HINT_FADE_MS,
  type GtaPhase,
} from '../features/room/gtaLifecycle.ts';
import { randomAvatar, participantAvatarSrc } from '../features/avatar/index.js';
import type { CarState } from '../features/room/gtaPhysics.ts';
import type { DriveInput, SeatBox } from '../types/gta.ts';

// Dev-only, network-free stage for GTA Mode (Stage 0 of the plan). Renders a
// seat ring, a drivable car and the full entry/exit lifecycle with no
// Firebase, no room and no streaming, so the feel of driving, the collision
// response and the animation timings can be tuned before any of the
// multiplayer work exists. Reached via ?visual-test=gta, and stripped from
// production by the same import.meta.env.DEV gate main.tsx applies to
// VisualTestHarness.

const SEAT_COUNT = 8;
const SEAT_SIZE = 52;
const WOBBLE_MS = 600;
const SQUASH_MS = 700;
const DRIVER_ID = 'p0';

type StyleVars = React.CSSProperties & Record<string, string | number>;

interface FixtureSeat {
  id: string;
  name: string;
  avatar: string;
  // Percentage position within the stage, so the layout reflows with the box.
  left: number;
  top: number;
}

function useFixtureSeats(): FixtureSeat[] {
  const [seats] = useState(() =>
    Array.from({ length: SEAT_COUNT }, (_, i) => {
      const half = SEAT_COUNT / 2;
      const onTop = i < half;
      const idx = onTop ? i : i - half;
      return {
        id: `p${i}`,
        name: `Player ${i + 1}`,
        avatar: participantAvatarSrc({ avatar: randomAvatar() }) ?? '',
        left: 12 + (idx / (half - 1)) * 76,
        top: onTop ? 16 : 78,
      };
    }),
  );
  return seats;
}

export default function GtaSandbox() {
  const seats = useFixtureSeats();
  const driver = seats.find(s => s.id === DRIVER_ID);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const seatNodes = useRef(new Map<string, HTMLElement>());
  const inputRef = useRef<DriveInput>({ forward: false, back: false, left: false, right: false });
  const carRef = useRef<CarState>(createCar(120, 200));
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  // The rAF loop reads the phase every frame, so it needs a ref as well as
  // state -- the closure captured at mount would otherwise see 'idle' forever.
  const phaseRef = useRef<GtaPhase>('idle');

  const [, forceRender] = useState(0);
  const [phase, setPhase] = useState<GtaPhase>('idle');
  const [speed, setSpeed] = useState(0);
  const [wobbling, setWobbling] = useState<Record<string, number>>({});
  const [squashed, setSquashed] = useState<Record<string, number>>({});
  const [showDebug, setShowDebug] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [hintClosing, setHintClosing] = useState(false);
  // Where the car blew up, so the ejected rider can fly home from there.
  const [wreck, setWreck] = useState<{ x: number; y: number } | null>(null);

  const debris = debrisPieces();

  const setPhaseBoth = (p: GtaPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // Advances phases that run on a timer. Driving and idle wait on a trigger
  // instead, so they fall through with no timeout scheduled.
  useEffect(() => {
    const ms = phaseDuration(phase);
    const next = nextPhase(phase);
    if (ms == null || next == null) return;
    const t = setTimeout(() => setPhaseBoth(next), ms);
    return () => clearTimeout(t);
  }, [phase]);

  // The driving hint: shown once driving starts, then faded out.
  useEffect(() => {
    if (phase !== 'driving') return;
    setHintVisible(true);
    setHintClosing(false);
    const fade = setTimeout(() => setHintClosing(true), HINT_MS);
    const gone = setTimeout(() => setHintVisible(false), HINT_MS + HINT_FADE_MS);
    return () => { clearTimeout(fade); clearTimeout(gone); };
  }, [phase]);

  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      const i = inputRef.current;
      if (k === 'arrowup' || k === 'w') i.forward = down;
      else if (k === 'arrowdown' || k === 's') i.back = down;
      else if (k === 'arrowleft' || k === 'a') i.left = down;
      else if (k === 'arrowright' || k === 'd') i.right = down;
      else return;
      e.preventDefault();
      // Any deliberate input dismisses the hint early -- once you're driving
      // you've clearly read it.
      if (down) setHintClosing(true);
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Measures obstacles in stage-local pixels -- the same approach
  // ThrowOverlay uses, and the reason the physics module never touches the DOM.
  const measureSeats = (): SeatBox[] => {
    const stage = stageRef.current;
    if (!stage) return [];
    const stageBox = stage.getBoundingClientRect();
    const out: SeatBox[] = [];
    // The table is an obstacle exactly like a seat -- the physics module takes
    // any box, so it needs no special case beyond being measured in.
    if (tableRef.current) {
      const t = tableRef.current.getBoundingClientRect();
      out.push({
        id: '__table__',
        x: t.left + t.width / 2 - stageBox.left,
        y: t.top + t.height / 2 - stageBox.top,
        w: t.width,
        h: t.height,
      });
    }
    for (const [id, node] of seatNodes.current) {
      // The driver isn't in their seat while driving, so it stops being an
      // obstacle -- otherwise the car collides with the chair it came from.
      if (id === DRIVER_ID && seatVacated(phaseRef.current)) continue;
      const b = node.getBoundingClientRect();
      out.push({
        id,
        x: b.left + b.width / 2 - stageBox.left,
        y: b.top + b.height / 2 - stageBox.top,
        w: b.width,
        h: b.height,
      });
    }
    return out;
  };

  useLayoutEffect(() => {
    const loop = (now: number) => {
      const stage = stageRef.current;
      if (stage && isDriveable(phaseRef.current)) {
        const prev = lastRef.current || now;
        // Clamped so a backgrounded tab resuming can't tunnel the car across
        // the whole board in one enormous step.
        const dt = Math.min(0.05, (now - prev) / 1000);
        lastRef.current = now;
        const box = stage.getBoundingClientRect();
        const out = stepCar(carRef.current, inputRef.current, dt, { w: box.width, h: box.height }, measureSeats());
        carRef.current = out.car;
        setSpeed(speedOf(out.car));
        if (out.bumpedIds.length) {
          const stamp = performance.now();
          setWobbling(w => {
            const next = { ...w };
            for (const id of out.bumpedIds) next[id] = stamp;
            return next;
          });
        }
        if (out.hitId) {
          const stamp = performance.now();
          setSquashed(s => ({ ...s, [out.hitId!]: stamp }));
        }
        forceRender(n => (n + 1) % 1000000);
      } else {
        // Keep the clock fresh while paused so resuming doesn't see a huge dt.
        lastRef.current = now;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Places the car beside the driver's seat and starts the entry sequence.
  const enterCar = () => {
    const stage = stageRef.current;
    const seatNode = seatNodes.current.get(DRIVER_ID);
    if (!stage || !seatNode) return;
    const sb = stage.getBoundingClientRect();
    const b = seatNode.getBoundingClientRect();
    // Nudged toward the middle of the board: a car parked hard against the
    // seat puts a later explosion half off-stage, and the entry animation
    // reads better with room around it.
    const seatX = b.left + b.width / 2 - sb.left;
    const seatY = b.top + b.height / 2 - sb.top;
    carRef.current = createCar(
      Math.min(seatX + 80, sb.width - CAR_W),
      Math.min(Math.max(seatY + 34, CAR_H), sb.height - CAR_H),
      Math.PI,
    );
    setWreck(null);
    setPhaseBoth('arriving');
  };

  // Blows the car up where it stands and sends the rider home.
  const endRound = () => {
    setWreck({ x: carRef.current.x, y: carRef.current.y });
    inputRef.current = { forward: false, back: false, left: false, right: false };
    setPhaseBoth('exploding');
  };

  const now = performance.now();
  const car = carRef.current;

  // Where the ejected rider has to travel to get back to their seat.
  const seatHome = (() => {
    const stage = stageRef.current;
    const node = seatNodes.current.get(DRIVER_ID);
    if (!stage || !node || !wreck) return { dx: 0, dy: 0, arc: 46 };
    const sb = stage.getBoundingClientRect();
    const b = node.getBoundingClientRect();
    // The arc peaks half-way home; cap its height at the headroom actually
    // available above the flight path so the rider never sails off-stage.
    const dx = b.left + b.width / 2 - sb.left - wreck.x;
    const dy = b.top + b.height / 2 - sb.top - wreck.y;
    const midY = wreck.y + dy * 0.5;
    return { dx, dy, arc: Math.max(12, Math.min(46, midY - 10)) };
  })();

  return (
    <div className="sp-app">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <span className="font-sp-mono text-xs font-bold text-sp-text">GTA sandbox</span>
        <button
          onClick={enterCar}
          disabled={phase !== 'idle'}
          className={`rounded border px-2.5 py-1 text-[11px] font-bold ${
            phase === 'idle'
              ? 'cursor-pointer border-sp-accent bg-sp-accent-panel text-sp-accent-text'
              : 'cursor-default border-sp-border bg-sp-panel-2 text-sp-text-faint opacity-50'
          }`}
        >GTA Mode</button>
        <button
          onClick={endRound}
          disabled={phase !== 'driving'}
          className={`rounded border px-2.5 py-1 text-[11px] font-bold ${
            phase === 'driving'
              ? 'cursor-pointer border-sp-border-strong bg-sp-panel-2 text-sp-text-dim'
              : 'cursor-default border-sp-border bg-sp-panel-2 text-sp-text-faint opacity-50'
          }`}
        >Start next round</button>
        <span className="font-sp-mono text-[11px] text-sp-text-dim">
          phase <strong className="text-sp-accent-text">{phase}</strong>
        </span>
        <span className="font-sp-mono text-[11px] text-sp-text-dim">
          speed {speed.toFixed(0)}/{MAX_SPEED}{speed >= SQUASH_SPEED ? ' · SQUASH' : ''}
        </span>
        <button
          onClick={() => setShowDebug(d => !d)}
          className="cursor-pointer rounded border border-sp-border-strong bg-sp-panel-2 px-2 py-1 text-[11px] text-sp-text-dim"
        >{showDebug ? 'Hide' : 'Show'} hitboxes</button>
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        <div
          ref={stageRef}
          className="relative w-full overflow-hidden rounded-[28px] border border-sp-border bg-sp-panel-2"
          style={{ maxWidth: 1000, height: 460 }}
        >
          {/* Stand-in for the real table */}
          <div
            ref={tableRef}
            className="absolute rounded-[28px] border border-sp-border bg-sp-table-center"
            style={{ left: '22%', top: '35%', width: '56%', height: '30%' }}
          />

          {seats.map(s => {
            const wobbleAt = wobbling[s.id];
            const squashAt = squashed[s.id];
            const isSquashed = squashAt && now - squashAt < SQUASH_MS;
            const isWobbling = !isSquashed && wobbleAt && now - wobbleAt < WOBBLE_MS;
            const vacated = s.id === DRIVER_ID && seatVacated(phase);
            return (
              <div
                key={s.id}
                className="absolute flex flex-col items-center gap-1"
                style={{ left: `${s.left}%`, top: `${s.top}%`, transform: 'translate(-50%, -50%)' }}
              >
                <img
                  ref={node => {
                    if (node) seatNodes.current.set(s.id, node);
                    else seatNodes.current.delete(s.id);
                  }}
                  src={s.avatar}
                  alt=""
                  className="block rounded-full border border-sp-border bg-sp-card-bg"
                  style={{
                    width: SEAT_SIZE,
                    height: SEAT_SIZE,
                    // While the driver is out of their seat it reads as an
                    // empty chair rather than a duplicate of the person who
                    // is visibly sitting in the car.
                    opacity: vacated ? 0.25 : 1,
                    transform: vacated ? 'scale(0.9)' : undefined,
                    transition: 'opacity 200ms ease, transform 200ms ease',
                    animation: isSquashed
                      ? `sp-gta-squash ${SQUASH_MS}ms cubic-bezier(.2,.8,.3,1)`
                      : isWobbling
                        ? `sp-gta-wobble ${WOBBLE_MS}ms ease-out`
                        : undefined,
                  }}
                />
                <span className="text-[10px] font-semibold text-sp-text-dim">{s.name}</span>
              </div>
            );
          })}

          {showDebug && seats.map(s => {
            const node = seatNodes.current.get(s.id);
            const stage = stageRef.current;
            if (!node || !stage) return null;
            const b = node.getBoundingClientRect();
            const sb = stage.getBoundingClientRect();
            return (
              <div
                key={`hb-${s.id}`}
                className="pointer-events-none absolute border border-dashed border-sp-accent opacity-50"
                style={{ left: b.left - sb.left, top: b.top - sb.top, width: b.width, height: b.height }}
              />
            );
          })}

          {/* The car itself, for every phase in which one exists. */}
          {hasCar(phase) && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: car.x,
                top: car.y,
                width: CAR_W,
                height: CAR_H,
                transform: `translate(-50%, -50%) rotate(${car.r}rad)`,
              }}
            >
              <div
                style={{
                  width: CAR_W,
                  height: CAR_H,
                  '--sp-gta-from-x': '160px',
                  '--sp-gta-from-y': '-10px',
                  animation:
                    phase === 'arriving' ? `sp-gta-arrive ${ARRIVE_MS}ms cubic-bezier(.2,.9,.3,1) both`
                    : phase === 'exploding' ? `sp-gta-explode ${EXPLODE_MS}ms ease-out both`
                    : undefined,
                } as StyleVars}
              >
                <div
                  style={{
                    // The rider only drops in during boarding; afterwards
                    // they simply ride along with the car.
                    animation: phase === 'boarding' ? `sp-gta-board ${BOARD_MS}ms cubic-bezier(.3,1.4,.5,1) both` : undefined,
                  }}
                >
                  {/* Empty while the car is still driving up -- the rider is
                      visibly still in their seat until boarding starts. */}
                  <CarWithRider
                    avatarUrl={phase === 'arriving' ? undefined : driver?.avatar}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Blast ring and debris, at the point of detonation. */}
          {phase === 'exploding' && wreck && (
            <>
              <div
                className="pointer-events-none absolute rounded-full border-solid border-[#ffca7a]"
                style={{
                  left: wreck.x, top: wreck.y, width: 70, height: 70,
                  marginLeft: -35, marginTop: -35,
                  animation: `sp-gta-blast ${EXPLODE_MS}ms ease-out both`,
                }}
              />
              {debris.map((d, i) => (
                <div
                  key={i}
                  className="pointer-events-none absolute rounded-[2px] bg-[#ffb347]"
                  style={{
                    left: wreck.x, top: wreck.y, width: 7, height: 7,
                    marginLeft: -3.5, marginTop: -3.5,
                    '--fx': `${d.fx}px`, '--fy': `${d.fy}px`, '--fr': `${d.fr}deg`,
                    animation: `sp-gta-debris ${EXPLODE_MS}ms ease-out ${d.delay}ms both`,
                  } as StyleVars}
                />
              ))}
            </>
          )}

          {/* The rider flung clear of the wreck, tumbling back to their seat. */}
          {phase === 'returning' && wreck && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: wreck.x, top: wreck.y,
                marginLeft: -SEAT_SIZE / 2, marginTop: -SEAT_SIZE / 2,
                '--sp-gta-back-x': `${seatHome.dx}px`,
                '--sp-gta-back-y': `${seatHome.dy}px`,
                '--sp-gta-arc': `${seatHome.arc}px`,
                animation: `sp-gta-eject ${RETURN_MS}ms cubic-bezier(.3,.6,.3,1) both`,
              } as StyleVars}
            >
              <img
                src={driver?.avatar}
                alt=""
                className="block rounded-full border border-sp-border bg-sp-card-bg"
                style={{ width: SEAT_SIZE, height: SEAT_SIZE }}
              />
            </div>
          )}

          {/* "Arrow keys to move" -- fades on its own, or early once you
              actually drive. */}
          {hintVisible && (
            <div
              className="pointer-events-none absolute bottom-4 left-1/2 flex items-center gap-2 rounded-[10px] border border-sp-accent-border bg-sp-accent-panel-2-transparent px-3.5 py-2 text-[12px] font-bold whitespace-nowrap text-sp-accent-text backdrop-blur-[6px]"
              style={{
                transform: 'translateX(-50%)',
                animation: `${hintClosing ? 'sp-tip-fade-out' : 'sp-tip-fade-in'} ${HINT_FADE_MS}ms ease both`,
              }}
            >
              <span className="font-sp-mono">← ↑ ↓ →</span>
              <span>or WASD to drive</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
