import { describe, it, expect } from 'vitest';
import { fracturePolygon } from './tableFracture.ts';

// The two halves of a split table are drawn as separate clip-paths, so
// nothing structurally stops them drifting into shapes that never fitted
// together. These pin the "was once one slab" invariant.
describe('fracturePolygon', () => {
  // Every point except the two outer corners lies on the fracture itself.
  function seamPoints(side: 'left' | 'right'): { x: number; y: number }[] {
    return fracturePolygon(side)
      .replace(/^polygon\(|\)$/g, '')
      .split(', ')
      .slice(1, -1)
      .map(p => {
        const [x, y] = p.split(' ');
        return { x: parseFloat(x), y: parseFloat(y) };
      });
  }

  it('gives the two pieces complementary edges that sum to the full width', () => {
    const left = seamPoints('left');
    const right = seamPoints('right');
    expect(left).toHaveLength(right.length);
    left.forEach((p, i) => expect(p.x + right[i].x).toBeCloseTo(100));
  });

  it('keeps both halves paired at the same heights', () => {
    const left = seamPoints('left');
    const right = seamPoints('right');
    left.forEach((p, i) => expect(p.y).toBe(right[i].y));
  });

  it('varies the bite depth rather than repeating one zigzag', () => {
    // An evenly-stepped sawtooth is what made the break read as decorative
    // rather than broken -- a handful of distinct depths is the point.
    expect(new Set(seamPoints('left').map(p => p.x)).size).toBeGreaterThan(5);
  });

  it('varies the vertical spacing between stops', () => {
    const ys = seamPoints('left').map(p => p.y);
    const gaps = ys.slice(1).map((y, i) => y - ys[i]);
    expect(new Set(gaps).size).toBeGreaterThan(2);
  });

  it('runs the full height of the piece so the break reaches both edges', () => {
    const ys = seamPoints('left').map(p => p.y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(100);
  });

  it('descends monotonically, so the edge never doubles back on itself', () => {
    const ys = seamPoints('left').map(p => p.y);
    ys.slice(1).forEach((y, i) => expect(y).toBeGreaterThan(ys[i]));
  });

  it('stays within the piece on both sides', () => {
    for (const side of ['left', 'right'] as const) {
      for (const { x } of seamPoints(side)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
      }
    }
  });
});
