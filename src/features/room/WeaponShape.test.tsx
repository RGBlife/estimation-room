import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import WeaponShape from './WeaponShape.tsx';

describe('the paper aeroplane sprite', () => {
  // The flight rotates the plane by a heading straight out of atan2, where
  // 0deg means "travelling to the right". The artwork has to agree with that
  // convention, and nothing else in the codebase enforces it: the original
  // sprite was drawn pointing up and to the right, so every heading landed
  // 45deg out. Because the shape is nearly symmetric about that diagonal, the
  // result didn't read as "rotated wrongly" -- it read as a plane locked at
  // one fixed attitude however it was thrown, which is a much harder bug to
  // spot in the source.
  function planeGeometry() {
    const { container } = render(<WeaponShape shape="paper-airplane" />);
    const svg = container.querySelector('svg')!;
    const viewBox = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const d = container.querySelector('path')!.getAttribute('d')!;
    // Every "L x y" / "M x y" pair in the outline.
    const points = [...d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map(m => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }));
    return { points, cx: (viewBox[0] + viewBox[2]) / 2, cy: (viewBox[1] + viewBox[3]) / 2 };
  }

  it('points its nose to the right, matching a 0deg heading', () => {
    const { points, cx, cy } = planeGeometry();
    // The nose is the leading point: furthest along the direction of travel,
    // which for a 0deg heading means furthest to the right. (Not the point
    // furthest from the centre -- on a swept-wing shape that is a wingtip.)
    const nose = points.reduce((lead, p) => (p.x > lead.x ? p : lead));
    const heading = (Math.atan2(nose.y - cy, nose.x - cx) * 180) / Math.PI;
    expect(Math.abs(heading), `nose points at ${heading.toFixed(1)}deg, not along 0deg`).toBeLessThan(15);

    // And it must genuinely lead: no part of the plane may stick out further
    // forward than the nose does.
    for (const p of points) expect(p.x).toBeLessThanOrEqual(nose.x);
  });

  it('keeps its tail behind the nose', () => {
    // Guards the other half of the same property: a sprite could point right
    // and still be drawn tail-first.
    const { points, cx } = planeGeometry();
    const noseX = Math.max(...points.map(p => p.x));
    const tailX = Math.min(...points.map(p => p.x));
    expect(noseX).toBeGreaterThan(cx);
    expect(tailX).toBeLessThan(cx);
  });

  it('is drawn within its own viewBox', () => {
    const { points } = planeGeometry();
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(28);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(28);
    }
  });
});
