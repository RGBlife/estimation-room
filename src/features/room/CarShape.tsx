import { CAR_W, CAR_H } from './gtaPhysics.ts';

// The kart, drawn inline like WeaponShape/TreeShape rather than shipped as
// an asset. Drawn pointing along +x so the physics heading (radians, 0 =
// east) maps straight onto a rotate() with no offset.
//
// "Open-top kart" (option C of the seating-treatment design): a go-kart
// rather than a car, chosen over the other three occlusion options
// (cockpit cut-out, head-above-the-sill, tinted glass canopy) because the
// avatar reads almost fully visible, ringed by the chassis, and stays most
// legible at the small size the kart actually renders at on the board.
// Deliberately spare -- no windscreen, roll bar or steering wheel -- since
// none of those appear in the reference design; the read comes entirely
// from the chassis ring wrapping around the rider with an opening at the
// front-left where their face shows through.

// Cockpit well: the dark recess the rider sits down into.
const WELL = { x: 24, y: 8, w: 40, h: 40, r: 12 };

// Tyres are near-black, which on the dark theme is within a hair of the page
// background (--sp-bg is oklch(0.17), the tyre ~oklch(0.18)) -- the wheels
// simply disappeared. A lighter rim around each one keeps them legible on
// both themes without theming the fill itself: the kart drives over the
// table, the page and the seats, so it can't rely on any one backdrop.
const TYRE_FILL = '#16161a';
const TYRE_RIM = '#6f6f78';
const TYRE_STROKE = 1.5;
// Inset by half the stroke width: the tyres sit flush against the viewBox's
// top and bottom edges, so a centred stroke would be clipped in half there
// and the rim would look thinner on the outside than the inside. Insetting
// keeps the outer silhouette exactly where it was.
const TYRE_INSET = TYRE_STROKE / 2;
const TYRES = [
  { x: 17, y: 0 }, { x: 17, y: 49 },
  { x: 62, y: 0 }, { x: 62, y: 49 },
];

interface CarShapeProps {
  color?: string;
  // Rendered pixel size -- defaults to the desktop reference size (CAR_W x
  // CAR_H) but shrinks on smaller boards (see carScale in GtaOverlay.tsx) so
  // the kart stays proportionate to a phone-sized table instead of towering
  // over it. The viewBox stays fixed at 96x58; only the rendered box scales.
  w?: number;
  h?: number;
}

// Everything BEHIND the rider: wheels, chassis ring, cockpit well.
export function CarBody({ color = '#e5484d', w = CAR_W, h = CAR_H }: CarShapeProps) {
  return (
    <svg width={w} height={h} viewBox="0 0 96 58" aria-hidden="true">
      {TYRES.map(t => (
        <rect
          key={`${t.x}-${t.y}`}
          x={t.x + TYRE_INSET}
          y={t.y + TYRE_INSET}
          width={20 - TYRE_STROKE}
          height={9 - TYRE_STROKE}
          rx="3"
          fill={TYRE_FILL}
          stroke={TYRE_RIM}
          strokeWidth={TYRE_STROKE}
        />
      ))}

      {/* The chassis ring -- a plain rounded-rect body, same footprint as
          the enclosed car had, but with no roof panel over the rider. */}
      <rect x="2" y="5" width="92" height="48" rx="13" fill={color} />
      {/* Cockpit well, so the rider reads as sitting down into the frame
          rather than pasted on top of a solid disc. */}
      <rect x={WELL.x} y={WELL.y} width={WELL.w} height={WELL.h} rx={WELL.r} fill="#1b0d0f" />

      <rect x="3" y="15" width="4" height="7" rx="2" fill="#ff6b6b" />
      <rect x="3" y="36" width="4" height="7" rx="2" fill="#ff6b6b" />
    </svg>
  );
}

// Everything IN FRONT of the rider: just the headlights -- open-top means
// nothing crosses the rider's body at all. Takes no color: unlike CarBody,
// nothing here is chassis-colored.
export function CarOverlay({ w = CAR_W, h = CAR_H }: Pick<CarShapeProps, 'w' | 'h'>) {
  return (
    <svg width={w} height={h} viewBox="0 0 96 58" aria-hidden="true">
      <circle cx="90" cy="18" r="3" fill="#ffe9a8" />
      <circle cx="90" cy="40" r="3" fill="#ffe9a8" />
    </svg>
  );
}

interface CarWithRiderProps extends CarShapeProps {
  avatarUrl?: string;
}

// Composed kart: body, then the rider sitting in full inside the ring, then
// the overlay (headlights only) that sits ahead of them. Nothing crops the
// rider -- the open-top read comes from the ring surrounding them rather
// than a panel occluding them. Rigidly part of the chassis (no
// counter-rotation), so they turn with the kart exactly like someone
// actually sitting in it would.
export default function CarWithRider({ color, avatarUrl, w = CAR_W, h = CAR_H }: CarWithRiderProps) {
  const scale = w / 96; // viewBox units -> px
  // Sized to fill the well, since nothing crops it -- the full disc is
  // visible, not just the head-and-shoulders.
  const head = 36 * scale;
  return (
    <div className="relative" style={{ width: w, height: h }}>
      <div className="absolute inset-0"><CarBody color={color} w={w} h={h} /></div>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt=""
          className="absolute rounded-full"
          style={{
            width: head,
            height: head,
            // Positioned in the car's own frame so the seat travels with the
            // chassis as it turns.
            left: 26 * scale,
            top: 9 * scale,
            // The avatar carries its own background disc. Rimming it and
            // dropping a shadow under it turns that disc from a stray light
            // patch into something that reads as a headrest in the well.
            boxShadow: '0 2px 3px rgba(0,0,0,0.55), inset 0 0 0 1.5px rgba(0,0,0,0.28)',
          }}
        />
      )}
      <div className="absolute inset-0 pointer-events-none"><CarOverlay w={w} h={h} /></div>
    </div>
  );
}
