import { useThrowAudio, squeakChicken } from './chickenSound.ts';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { WEAPONS, FRAG_ANGLES } from './weapons.ts';
import WeaponShape from './WeaponShape.tsx';
import TreeShape from './TreeShape.tsx';
import { glidePose } from './glideFlight.ts';
import { flightTimeScale } from './flightTimeScale.ts';
import type { ThrowEvent } from '../../types/throws.ts';

const FLY_MS = 550;
const GLIDE_MS = 950;
const IMPACT_MS = 850;
const TREE_MS = 1800;

// CSSProperties doesn't allow arbitrary custom-property keys (--sx, --tx,
// etc.) by default -- these are read by the @keyframes in theme.css via
// var(), not by React/CSS itself, so a plain string-keyed style object is
// the correct escape hatch here.
type StyleWithVars = CSSProperties & Record<string, string | number>;

interface Geometry {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

function randomRotation() {
  return Math.round(Math.random() * 40 - 20) + 'deg';
}

function fragmentOffsets() {
  return FRAG_ANGLES.map((a, i) => {
    const rad = a * Math.PI / 180;
    const dist = 24 + (i % 3) * 9;
    return { fx: Math.round(Math.cos(rad) * dist), fy: Math.round(Math.sin(rad) * dist) };
  });
}

// The flying element is a 28x28 sprite pinned at left:0/top:0, so a bare
// translate() puts its top-left corner on the path and the plane rides about
// 14px down and to the right of where it should be -- most visible at the
// target, where it lands off-centre on the avatar.
const SPRITE_HALF = 14;

function flightTransform(pose: { x: number; y: number; scale: number; angle: number }) {
  return `translate(${pose.x - SPRITE_HALF}px, ${pose.y - SPRITE_HALF}px) scale(${pose.scale}) rotate(${pose.angle}deg)`;
}

function prefersReducedMotion() {
  // matchMedia is missing in jsdom, and the flight is decorative either way,
  // so treat an unanswerable query as "no preference expressed".
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * Drives the glide frame by frame.
 *
 * The other weapons are pure CSS keyframes, which stay on the compositor and
 * need no JavaScript. The plane can't be: its path is a bezier, and keyframes
 * can only interpolate in straight lines between stops (see glideFlight.ts).
 * So this writes the transform itself, once per frame, straight to the node --
 * no React state per frame, since re-rendering sixty times a second to move
 * one element would be far more expensive than the animation it replaces.
 *
 * Returns a ref to attach to the flying element. `onDone` fires on the frame
 * the flight completes, taking the place of the onAnimationEnd that CSS
 * animations get for free.
 */
function useGlideFlight(
  geometry: Geometry | null,
  active: boolean,
  durationMs: number,
  onDone: () => void,
) {
  const nodeRef = useRef<HTMLDivElement>(null);
  // Held in a ref so a re-render mid-flight doesn't restart the animation
  // through the effect's dependency list.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !geometry || !active) return;
    const from = { x: geometry.sx, y: geometry.sy };
    const to = { x: geometry.tx, y: geometry.ty };

    // Reduced motion: no flight at all. The CSS media query that covers the
    // ambient animations can't reach a transform written from JS, so the
    // preference has to be honoured here instead. Park it at the target and
    // hand straight over to the impact.
    if (prefersReducedMotion()) {
      const pose = glidePose(from, to, 1);
      node.style.transform = flightTransform(pose);
      node.style.opacity = '1';
      const id = window.setTimeout(() => doneRef.current(), 80);
      return () => window.clearTimeout(id);
    }

    const scaled = durationMs * flightTimeScale();
    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / scaled);
      const pose = glidePose(from, to, t);
      node.style.transform = flightTransform(pose);
      // Fade in over the first fraction of the flight rather than popping into
      // existence at full opacity, matching what the keyframes did at 8%.
      node.style.opacity = t < 0.08 ? String(t / 0.08) : '1';
      if (t < 1) raf = requestAnimationFrame(step);
      else doneRef.current();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [geometry, active, durationMs]);

  return nodeRef;
}

interface ThrowVisualProps {
  t: ThrowEvent;
  geometry: Geometry | null;
  onDone: () => void;
}

function ThrowVisual({ t, geometry, onDone }: ThrowVisualProps) {
  const [phase, setPhase] = useState<'fly' | 'impact' | 'tree'>('fly');
  const sounded = useRef(false);
  useEffect(() => {
    if (phase === 'impact' && t.weaponId === 'rubber-chicken' && !sounded.current) {
      sounded.current = true;
      squeakChicken();
    }
  }, [phase, t.weaponId]);
  const rot = useMemo(randomRotation, []);
  const fragments = useMemo(fragmentOffsets, []);
  const meta = WEAPONS.find(w => w.id === t.weaponId);

  const isGlide = meta?.flight === 'sp-fly-glide';
  // Hooks can't sit behind the early return below, so the flight is always
  // declared and simply inert unless this is a glide that's currently flying.
  const glideRef = useGlideFlight(
    geometry,
    isGlide && phase === 'fly',
    GLIDE_MS,
    () => setPhase('impact'),
  );

  if (!meta || !geometry) return null;

  const isSnowball = t.weaponId === 'snowball';
  const showBall = phase === 'fly' || (phase === 'impact' && !isSnowball);
  const showFragments = phase === 'impact' && isSnowball;
  const showTree = phase === 'tree';

  const vars: StyleWithVars = { '--sx': `${geometry.sx}px`, '--sy': `${geometry.sy}px`, '--tx': `${geometry.tx}px`, '--ty': `${geometry.ty}px`, '--rot': rot };
  if (isGlide) {
    // The plane's impact starts from wherever the dive actually ended, so the
    // handoff needs the flight's final pose rather than the shared scale(1.15)
    // the other weapons' impacts open on.
    const end = glidePose({ x: geometry.sx, y: geometry.sy }, { x: geometry.tx, y: geometry.ty }, 1);
    vars['--glide-end-rot'] = `${end.angle}deg`;
    vars['--glide-end-scale'] = String(end.scale);
    // The impact keyframes position the plane themselves, so they need the
    // same centring offset the flight applies -- otherwise it jumps 14px on
    // the handoff.
    vars['--glide-end-x'] = `${geometry.tx - SPRITE_HALF}px`;
    vars['--glide-end-y'] = `${geometry.ty - SPRITE_HALF}px`;
  }

  const impactName = isGlide ? 'sp-impact-plane' : meta.impact;
  const wrapStyle: StyleWithVars = phase === 'fly'
    ? isGlide
      // Driven per-frame from JS (see useGlideFlight): no CSS animation, and
      // opacity starts at 0 because the first frame hasn't been written yet.
      ? { position: 'absolute', left: 0, top: 0, ...vars, opacity: 0 }
      : { position: 'absolute', left: 0, top: 0, ...vars, animation: `sp-fly-to ${FLY_MS / 1000}s cubic-bezier(.3,.6,.3,1) forwards` }
    : { position: 'absolute', left: 0, top: 0, ...vars, animation: `${impactName} ${IMPACT_MS / 1000}s ease-out forwards` };

  // Weapons with an afterEffect (currently just Bob Ross's tree) get a third
  // phase once the impact animation finishes, instead of finishing the throw
  // right away.
  //
  // The glide reaches 'impact' from its own rAF loop rather than from an
  // animationend event, so its fly->impact leg never passes through here --
  // hence the impact-phase branch below, which retires the throw once the
  // impact animation itself ends. Every other weapon still lands in the
  // 'fly' branch first, exactly as before.
  const handleAnimEnd = () => {
    if (phase === 'fly') {
      setPhase('impact');
      if (!meta.afterEffect) setTimeout(onDone, IMPACT_MS + 50);
    } else if (phase === 'impact' && meta.afterEffect === 'tree') {
      setPhase('tree');
      setTimeout(onDone, TREE_MS + 50);
    } else if (phase === 'impact' && isGlide) {
      onDone();
    }
  };

  return (
    <>
      {showBall && (
        <div ref={isGlide ? glideRef : undefined} style={wrapStyle} onAnimationEnd={handleAnimEnd}>
          {meta.shape ? <WeaponShape shape={meta.shape} /> : null}
          {meta.hasEmoji && <span className="text-[30px] leading-none">{meta.glyph}</span>}
        </div>
      )}
      {showFragments && fragments.map((f, i) => (
        <div
          key={i}
          onAnimationEnd={i === 0 ? handleAnimEnd : undefined}
          style={{
            position: 'absolute', left: 0, top: 0, width: 8, height: 8, borderRadius: '50%',
            background: '#fdfeff', border: '1px solid #cfe3f7',
            '--tx': `${geometry.tx}px`, '--ty': `${geometry.ty}px`, '--fx': `${f.fx}px`, '--fy': `${f.fy}px`,
            animation: 'sp-frag-burst 0.7s ease-out forwards',
          } as StyleWithVars}
        />
      ))}
      {showTree && (
        <div
          style={{
            position: 'absolute', left: -17, top: -34, ...vars,
            animation: `sp-tree-grow ${TREE_MS / 1000}s cubic-bezier(0.2, 0.8, 0.2, 1) forwards`,
          } as StyleWithVars}
        >
          <TreeShape />
        </div>
      )}
    </>
  );
}

// Renders active weapon throws as absolutely-positioned overlays inside the
// shared table "stage" container. Geometry (start/end coordinates) is
// computed once per throw, from live DOM rects, and frozen — seats can move
// as the table resizes, but a throw already in flight shouldn't retarget.
interface ThrowOverlayProps {
  throws: ThrowEvent[];
  getSeatNode: (id: string) => HTMLElement | null;
  stageNode: HTMLElement | null;
  onThrowDone: (id: string) => void;
}

export default function ThrowOverlay({ throws, getSeatNode, stageNode, onThrowDone }: ThrowOverlayProps) {
  useThrowAudio();
  const geometryCacheRef = useRef(new Map<string, Geometry>());

  const getGeometry = (t: ThrowEvent): Geometry | null => {
    const cache = geometryCacheRef.current;
    if (cache.has(t.id)) return cache.get(t.id) ?? null;
    if (!stageNode) return null;
    const fromNode = getSeatNode(t.fromUid);
    const toNode = getSeatNode(t.toUid);
    if (!fromNode || !toNode) return null;
    const stageBox = stageNode.getBoundingClientRect();
    const fromBox = fromNode.getBoundingClientRect();
    const toBox = toNode.getBoundingClientRect();
    const offsetX = t.offsetX ?? 0;
    const offsetY = t.offsetY ?? 0;
    const geometry = {
      sx: fromBox.left + fromBox.width / 2 - stageBox.left,
      sy: fromBox.top + fromBox.height / 2 - stageBox.top,
      tx: toBox.left + toBox.width / 2 - stageBox.left + offsetX * toBox.width,
      ty: toBox.top + toBox.height / 2 - stageBox.top + offsetY * toBox.height,
    };
    cache.set(t.id, geometry);
    return geometry;
  };

  const activeIds = new Set(throws.map(t => t.id));
  for (const id of geometryCacheRef.current.keys()) {
    if (!activeIds.has(id)) geometryCacheRef.current.delete(id);
  }

  return (
    <div data-testid="throw-layer" className="absolute inset-0 z-10 pointer-events-none">
      {throws.map(t => (
        <ThrowVisual key={t.id} t={t} geometry={getGeometry(t)} onDone={() => onThrowDone(t.id)} />
      ))}
    </div>
  );
}
