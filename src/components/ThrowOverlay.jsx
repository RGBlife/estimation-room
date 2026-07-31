import { useMemo, useRef, useState } from 'react';
import { WEAPONS, FRAG_ANGLES } from '../lib/weapons.js';

const FLY_MS = 550;
const IMPACT_MS = 850;

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
  const showBall = phase === 'fly' || (phase === 'impact' && !isSnowball);
  const showFragments = phase === 'impact' && isSnowball;

  const vars = { '--sx': `${geometry.sx}px`, '--sy': `${geometry.sy}px`, '--tx': `${geometry.tx}px`, '--ty': `${geometry.ty}px`, '--rot': rot };
  const wrapStyle = phase === 'fly'
    ? { position: 'absolute', left: 0, top: 0, ...vars, animation: `sp-fly-to ${FLY_MS / 1000}s cubic-bezier(.3,.6,.3,1) forwards` }
    : { position: 'absolute', left: 0, top: 0, ...vars, animation: `${meta.impact} ${IMPACT_MS / 1000}s ease-out forwards` };

  const handleAnimEnd = () => {
    if (phase === 'fly') {
      setPhase('impact');
      setTimeout(onDone, IMPACT_MS + 50);
    }
  };

  return (
    <>
      {showBall && (
        <div style={wrapStyle} onAnimationEnd={handleAnimEnd}>
          {meta.shape === 'microwave' && (
            <div style={{ width: 26, height: 19, borderRadius: 4, background: '#c7cdd6', border: '2px solid #4a5568', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 3, left: 3, width: 11, height: 11, borderRadius: '50%', background: '#2b3440' }} />
            </div>
          )}
          {meta.shape === 'snowball' && (
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fdfeff', border: '2px solid #cfe3f7', boxShadow: 'inset -3px -3px 0 #e3eef9' }} />
          )}
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
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {throws.map(t => (
        <ThrowVisual key={t.id} t={t} geometry={getGeometry(t)} onDone={() => onThrowDone(t.id)} />
      ))}
    </div>
  );
}
