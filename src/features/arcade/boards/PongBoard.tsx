import { useEffect, useRef } from 'react';
import Countdown, { ClockBar } from './Countdown.tsx';
import { ballAt, LENGTH, PADDLE_AT, RADIUS, REACH, WIDTH } from '../play/pong.ts';
import { nameFor, sideTone, sidesOf, type BoardProps } from './types.ts';

// The court, upright, with you at the near end whichever side you are. The
// ball is drawn on from its last known speed between frames (they come
// twenty a second), trailing a short tail; your own paddle follows your
// finger or mouse at once, and the other glides to where it was last seen.
// The arrow keys move your paddle too.
const STEER_MS = 50;
const KEY_SPEED = 80;
const EXTRAPOLATE_MS = 120;
const INKS = ['--sp-court-line', '--sp-court-ball', '--sp-side-a', '--sp-side-b'] as const;

export default function PongBoard({ duel, uid, player, onSteer, clock }: BoardProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { near, far } = sidesOf(duel, uid);
  // Seen from the opponent's end, the court turns round.
  const flipped = duel.opponent.uid === near.uid;
  const live = useRef({ duel, at: performance.now() });
  const ballKey = duel.ball?.join(',');
  useEffect(() => { live.current = { duel, at: performance.now() }; }, [duel, ballKey]);
  // Your paddle across the court from your end, 0 to 1, and when it was last sent.
  const mine = useRef<number | null>(null);
  const sent = useRef(0);
  const keys = useRef({ left: false, right: false });

  useEffect(() => {
    const steer = (x: number) => {
      mine.current = Math.max(REACH / WIDTH, Math.min(1 - REACH / WIDTH, x));
      const now = performance.now();
      if (now - sent.current >= STEER_MS) { sent.current = now; onSteer({ x: mine.current }); }
    };
    const node = canvas.current!;
    const move = (event: PointerEvent) => {
      if (!player) return;
      const box = node.getBoundingClientRect();
      steer((event.clientX - box.left) / box.width);
    };
    const key = (down: boolean) => (event: KeyboardEvent) => {
      if (!player || (event.target as HTMLElement)?.closest?.('input, textarea')) return;
      if (event.key === 'ArrowLeft' || event.key === 'a') { keys.current.left = down; event.preventDefault(); }
      if (event.key === 'ArrowRight' || event.key === 'd') { keys.current.right = down; event.preventDefault(); }
    };
    const onDown = key(true), onUp = key(false);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerdown', move);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);

    const trail: [number, number][] = [];
    const inks = { at: -Infinity, colours: {} as Record<string, string> };
    let frame = 0, last = performance.now(), shownTheirs: number | null = null;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const { duel: d, at } = live.current;
      if (keys.current.left !== keys.current.right) {
        const seen = (d.paddles?.[near.uid] ?? WIDTH / 2) / WIDTH;
        steer((mine.current ?? (flipped ? 1 - seen : seen)) + (keys.current.right ? 1 : -1) * KEY_SPEED / WIDTH * dt);
      }
      const context = node.getContext('2d');
      if (!context) return;
      const scale = window.devicePixelRatio || 1;
      const w = node.clientWidth, h = node.clientHeight;
      if (node.width !== Math.round(w * scale)) { node.width = Math.round(w * scale); node.height = Math.round(h * scale); }
      context.setTransform(scale, 0, 0, scale, 0, 0);
      // The theme's colours, read from the page once a second rather than
      // every frame: reading styles is the dearest part of a frame.
      if (now - inks.at > 1000) {
        const styles = getComputedStyle(node);
        for (const name of INKS) inks.colours[name] = styles.getPropertyValue(name).trim() || '#fff';
        inks.at = now;
      }
      const ink = (name: typeof INKS[number]) => inks.colours[name];
      // From the court's own measures to the screen, near end at the bottom.
      const toScreen = (d0: number, l0: number): [number, number] => flipped ? [(WIDTH - l0) / WIDTH * w, d0 / LENGTH * h] : [l0 / WIDTH * w, (LENGTH - d0) / LENGTH * h];
      context.clearRect(0, 0, w, h);
      context.strokeStyle = ink('--sp-court-line'); context.lineWidth = 2; context.setLineDash([6, 8]);
      context.beginPath(); context.moveTo(0, h / 2); context.lineTo(w, h / 2); context.stroke(); context.setLineDash([]);
      // Paddles: yours where you put it, theirs easing to where it was last seen.
      const paddle = (uidOf: string, across: number) => {
        const end = uidOf === d.challenger.uid ? PADDLE_AT : LENGTH - PADDLE_AT;
        const [x, y] = toScreen(end, across);
        const half = REACH / WIDTH * w;
        context.fillStyle = ink(sideTone(d, uidOf) === 'a' ? '--sp-side-a' : '--sp-side-b');
        context.beginPath(); context.roundRect(x - half, y - 5, half * 2, 10, 5); context.fill();
      };
      const theirsAt = d.paddles?.[far.uid] ?? WIDTH / 2;
      shownTheirs = shownTheirs === null ? theirsAt : shownTheirs + (theirsAt - shownTheirs) * Math.min(1, dt * 14);
      paddle(far.uid, shownTheirs);
      paddle(near.uid, player && mine.current !== null ? (flipped ? 1 - mine.current : mine.current) * WIDTH : d.paddles?.[near.uid] ?? WIDTH / 2);
      if (d.ball && d.status === 'playing') {
        const ahead = d.paused ? 0 : Math.min(now - at, EXTRAPOLATE_MS) / 1000;
        const [bd, bl] = ballAt(d.ball, ahead);
        const [x, y] = toScreen(Math.max(0, Math.min(LENGTH, bd)), bl);
        if (d.ball[2] !== 0) trail.push([x, y]); else trail.length = 0;
        if (trail.length > 8) trail.shift();
        trail.forEach(([tx, ty], i) => {
          context.globalAlpha = (i + 1) / trail.length * 0.35;
          context.fillStyle = ink('--sp-court-ball');
          context.beginPath(); context.arc(tx, ty, RADIUS / WIDTH * w * 0.8, 0, Math.PI * 2); context.fill();
        });
        context.globalAlpha = 1;
        context.fillStyle = ink('--sp-court-ball');
        context.beginPath(); context.arc(x, y, RADIUS / WIDTH * w * 1.2, 0, Math.PI * 2); context.fill();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerdown', move);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [player, flipped, near.uid, far.uid, onSteer]);

  const serving = duel.status === 'playing' && !clock.startsIn && duel.ball?.[2] === 0 && (duel.serveInMs ?? 0) > 0;
  return (
    <div className="sp-pong">
      <ClockBar left={clock.endsIn} total={duel.limitMs} />
      <div className="sp-pong-court">
        <span className="sp-pong-score" data-end="far" data-tone={sideTone(duel, far.uid)}>{nameFor(far, uid)} <b>{duel.points?.[far.uid] ?? 0}</b></span>
        <canvas ref={canvas} role="img" aria-label={`Pong: ${nameFor(near, uid)} ${duel.points?.[near.uid] ?? 0}, ${nameFor(far, uid)} ${duel.points?.[far.uid] ?? 0}`} style={{ touchAction: 'none' }} />
        <span className="sp-pong-score" data-end="near" data-tone={sideTone(duel, near.uid)}>{nameFor(near, uid)} <b>{duel.points?.[near.uid] ?? 0}</b></span>
        <Countdown ms={clock.startsIn} />
        {serving && <span className="sp-pong-serve" key={`${duel.points?.[near.uid]}-${duel.points?.[far.uid]}`}>Point!</span>}
      </div>
    </div>
  );
}
