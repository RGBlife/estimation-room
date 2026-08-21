// Geometry for the break down the middle of a table that GTA Mode has
// smashed in two. Kept apart from SeatTable so the shape can be reasoned
// about (and tested) as plain data, with no React or DOM in the way.

// The fracture line itself, as a list of [y%, bite%] stops. Both halves
// derive their clip-path from this one source so the broken edges stay
// complementary -- they have to read as having once been a single slab,
// which is exactly what a hand-maintained pair of polygons drifts away from.
// Deliberately irregular in both axes (uneven vertical spacing, varying bite
// depth, with deeper notches at 34% and 71%): an evenly-stepped zigzag reads
// as pinking shears, not as something that snapped under a car.
const FRACTURE_STOPS: [number, number][] = [
  [0, 50], [9, 41], [16, 47], [23, 38], [34, 29],
  [42, 44], [49, 36], [58, 46], [64, 33], [71, 26],
  [79, 43], [86, 35], [93, 45], [100, 39],
];

// The left piece owns everything left of the fracture; the right piece owns
// the mirror image, so the two interlock.
export function fracturePolygon(side: 'left' | 'right'): string {
  const pts = FRACTURE_STOPS.map(([y, bite]) =>
    side === 'left' ? `${bite + 50}% ${y}%` : `${50 - bite}% ${y}%`);
  return side === 'left'
    ? `polygon(0% 0%, ${pts.join(', ')}, 0% 100%)`
    : `polygon(100% 0%, ${pts.join(', ')}, 100% 100%)`;
}
