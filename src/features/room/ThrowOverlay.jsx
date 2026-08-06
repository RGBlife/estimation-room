import { useMemo, useRef, useState } from 'react';
import { WEAPONS, FRAG_ANGLES } from './weapons.js';
import WeaponShape from './WeaponShape.jsx';
import TreeShape from './TreeShape.jsx';

const FLY_MS = 550;
const GLIDE_MS = 950;
const IMPACT_MS = 850;
const TREE_MS = 1800;

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

function ThrowVisual({ t, geometry, onDone }) {
  const [phase, setPhase] = useState('fly');
  const rot = useMemo(randomRotation, []);
  const fragments = useMemo(fragmentOffsets, []);
  const meta = WEAPONS.find(w => w.id === t.weaponId);
  if (!meta || !geometry) return null;

  const isSnowball = t.weaponId === 'snowball';
  const isGlide = meta.flight === 'sp-fly-glide';
  const showBall = phase === 'fly' || (phase === 'impact' && !isSnowball);
  const showFragments = phase === 'impact' && isSnowball;
  const showTree = phase === 'tree';

  const vars = { '--sx': `${geometry.sx}px`, '--sy': `${geometry.sy}px`, '--tx': `${geometry.tx}px`, '--ty': `${geometry.ty}px`, '--rot': rot };
  if (isGlide) {
    // A gentle S-curve bank: swing wide past the midpoint, then curl back in
    // to the target, so the plane reads as gliding rather than flying dead-straight.
    const mx1 = geometry.sx + (geometry.tx - geometry.sx) * 0.4 + (geometry.ty - geometry.sy) * 0.18;
    const my1 = geometry.sy + (geometry.ty - geometry.sy) * 0.4 - (geometry.tx - geometry.sx) * 0.18;
    const mx2 = geometry.sx + (geometry.tx - geometry.sx) * 0.75 - (geometry.ty - geometry.sy) * 0.1;
    const my2 = geometry.sy + (geometry.ty - geometry.sy) * 0.75 + (geometry.tx - geometry.sx) * 0.1;
    const baseAngle = Math.atan2(geometry.ty - geometry.sy, geometry.tx - geometry.sx) * 180 / Math.PI;
    vars['--glide-start'] = `${baseAngle - 10}deg`;
    vars['--glide-mid'] = `${baseAngle + 14}deg`;
    vars['--glide-mid2'] = `${baseAngle - 8}deg`;
    vars['--rot'] = `${baseAngle}deg`;
    vars['--glide-mx'] = `${mx1}px`;
    vars['--glide-my'] = `${my1}px`;
    vars['--glide-mx2'] = `${mx2}px`;
    vars['--glide-my2'] = `${my2}px`;
  }
  const flyMs = isGlide ? GLIDE_MS : FLY_MS;
  const wrapStyle = phase === 'fly'
    ? { position: 'absolute', left: 0, top: 0, ...vars, animation: `${isGlide ? 'sp-fly-glide' : 'sp-fly-to'} ${flyMs / 1000}s cubic-bezier(.3,.6,.3,1) forwards` }
    : { position: 'absolute', left: 0, top: 0, ...vars, animation: `${meta.impact} ${IMPACT_MS / 1000}s ease-out forwards` };

  // Weapons with an afterEffect (currently just Bob Ross's tree) get a third
  // phase once the impact animation finishes, instead of finishing the throw
  // right away.
  const handleAnimEnd = () => {
    if (phase === 'fly') {
      setPhase('impact');
      if (!meta.afterEffect) setTimeout(onDone, IMPACT_MS + 50);
    } else if (phase === 'impact' && meta.afterEffect === 'tree') {
      setPhase('tree');
      setTimeout(onDone, TREE_MS + 50);
    }
  };

  return (
    <>
      {showBall && (
        <div style={wrapStyle} onAnimationEnd={handleAnimEnd}>
          {meta.shape ? <WeaponShape shape={meta.shape} /> : null}
          {meta.hasEmoji && <span style={{ fontSize: 30, lineHeight: 1 }}>{meta.glyph}</span>}
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
          }}
        />
      ))}
      {showTree && (
        <div
          style={{
            position: 'absolute', left: -17, top: -34, ...vars,
            animation: `sp-tree-grow ${TREE_MS / 1000}s cubic-bezier(0.2, 0.8, 0.2, 1) forwards`,
          }}
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
export default function ThrowOverlay({ throws, getSeatNode, stageNode, onThrowDone }) {
  const geometryCacheRef = useRef(new Map());

  const getGeometry = (t) => {
    const cache = geometryCacheRef.current;
    if (cache.has(t.id)) return cache.get(t.id);
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
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
      {throws.map(t => (
        <ThrowVisual key={t.id} t={t} geometry={getGeometry(t)} onDone={() => onThrowDone(t.id)} />
      ))}
    </div>
  );
}
