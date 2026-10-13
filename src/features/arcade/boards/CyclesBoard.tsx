import { useEffect, useRef } from 'react';
import Countdown, { ClockBar } from './Countdown.tsx';
import { FIRST_TO, SIZE, STARTS, trail } from '../play/cycles.ts';
import { useCountdown } from '../duels.ts';
import { nameFor, sideTone, sidesOf, type BoardProps } from './types.ts';

// A dark grid with two glowing walls growing across it, drawn on every
// screen from the turns alone. Steer with the arrow keys (or WASD), by
// swiping on the grid, or with the pad of arrows under it. A crash
// bursts where it happened.
const KEYS: Record<string, number> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
const ARROWS = [{ dir: 0, label: 'Up', glyph: '↑' }, { dir: 3, label: 'Left', glyph: '←' }, { dir: 2, label: 'Down', glyph: '↓' }, { dir: 1, label: 'Right', glyph: '→' }];

export default function CyclesBoard({ duel, uid, player, playable, onSteer, clock }: BoardProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { near, far } = sidesOf(duel, uid);
  const turn = (dir: number) => { if (playable) onSteer({ dir }); };
  // Between rounds: the count to the next ride, from when it was sent.
  const rideIn = useCountdown(duel.phase === 'ready' ? duel.rideInMs : undefined, duel.round);

  useEffect(() => {
    if (!player) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest?.('input, textarea')) return;
      const dir = KEYS[event.key];
      if (dir === undefined) return;
      event.preventDefault();
      if (playable) onSteer({ dir });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player, playable, onSteer]);

  // Drawn whenever the duel changes: a step is a frame.
  useEffect(() => {
    const node = canvas.current;
    const context = node?.getContext('2d');
    if (!node || !context) return;
    const scale = window.devicePixelRatio || 1;
    const size = node.clientWidth;
    if (node.width !== Math.round(size * scale)) { node.width = Math.round(size * scale); node.height = Math.round(size * scale); }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    const styles = getComputedStyle(node);
    const ink = (name: string) => styles.getPropertyValue(name).trim() || '#fff';
    const cell = size / SIZE;
    context.clearRect(0, 0, size, size);
    context.strokeStyle = ink('--sp-court-line'); context.lineWidth = 1;
    for (let i = 1; i < SIZE; i++) {
      context.beginPath(); context.moveTo(i * cell, 0); context.lineTo(i * cell, size); context.stroke();
      context.beginPath(); context.moveTo(0, i * cell); context.lineTo(size, i * cell); context.stroke();
    }
    [duel.challenger, duel.opponent].forEach((side, i) => {
      const squares = trail(STARTS[i], duel.turns?.[side.uid] ?? [], duel.steps ?? 0);
      const colour = ink(sideTone(duel, side.uid) === 'a' ? '--sp-side-a' : '--sp-side-b');
      const crashed = duel.crashed?.includes(side.uid);
      // The wall: a glowing line through the middle of each square ridden.
      context.save();
      context.shadowColor = colour; context.shadowBlur = cell * 0.8;
      context.strokeStyle = colour; context.lineWidth = cell * 0.5; context.lineCap = 'round'; context.lineJoin = 'round';
      context.beginPath();
      const shown = crashed ? squares.slice(0, -1) : squares;
      shown.forEach(([x, y], n) => (n ? context.lineTo : context.moveTo).call(context, (x + 0.5) * cell, (y + 0.5) * cell));
      context.stroke();
      const [hx, hy] = shown[shown.length - 1];
      context.fillStyle = '#fff';
      context.beginPath(); context.arc((hx + 0.5) * cell, (hy + 0.5) * cell, cell * 0.36, 0, Math.PI * 2); context.fill();
      context.restore();
      if (crashed) {
        const [cx, cy] = squares[squares.length - 1];
        context.fillStyle = colour;
        for (let k = 0; k < 8; k++) {
          const angle = k * Math.PI / 4;
          context.beginPath();
          context.arc((Math.max(0, Math.min(SIZE - 1, cx)) + 0.5 + Math.cos(angle) * 0.7) * cell, (Math.max(0, Math.min(SIZE - 1, cy)) + 0.5 + Math.sin(angle) * 0.7) * cell, cell * 0.22, 0, Math.PI * 2);
          context.fill();
        }
      }
    });
  });

  const swipe = useRef<[number, number] | null>(null);
  const result = duel.phase === 'result' && duel.crashed
    ? duel.crashed.length === 2 ? 'Both crashed. No score' : `${nameFor(duel.crashed[0] === near.uid ? near : far, uid)} crashed`
    : null;
  return (
    <div className="sp-cycles">
      <ClockBar left={clock.endsIn} total={duel.limitMs} />
      <div className="sp-reaction-score">
        {[near, far].map(side => (
          <span key={side.uid} data-tone={sideTone(duel, side.uid)}>
            {nameFor(side, uid)}
            <i aria-label={`${duel.won?.[side.uid] ?? 0} of ${FIRST_TO} rounds`}>
              {Array.from({ length: FIRST_TO }, (_, i) => <b key={i} data-won={i < (duel.won?.[side.uid] ?? 0) || undefined} />)}
            </i>
          </span>
        ))}
      </div>
      <div className="sp-cycles-arena"
        onPointerDown={event => { swipe.current = [event.clientX, event.clientY]; }}
        onPointerUp={event => {
          const from = swipe.current; swipe.current = null;
          if (!from) return;
          const dx = event.clientX - from[0], dy = event.clientY - from[1];
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
          turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
        }}>
        <canvas ref={canvas} role="img" aria-label={`Light cycles, round ${duel.round ?? 1}`} style={{ touchAction: 'none' }} />
        <Countdown ms={clock.startsIn || rideIn} label={`Round ${duel.round ?? 1}`} />
        {result && <span className="sp-cycles-result" key={`${duel.round}-${result}`}>{result}</span>}
      </div>
      {player && (
        <div className="sp-cycles-pad" aria-label="Steer">
          {ARROWS.map(a => <button key={a.dir} type="button" className="sp-planning-secondary" aria-label={a.label} disabled={!playable} data-dir={a.dir}
            onPointerDown={event => { event.preventDefault(); turn(a.dir); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); turn(a.dir); } }}>{a.glyph}</button>)}
        </div>
      )}
    </div>
  );
}
