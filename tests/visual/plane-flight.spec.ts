import { test, expect } from '@playwright/test';

// The paper aeroplane's flight is driven per-frame from JavaScript rather than
// by CSS keyframes (see src/features/room/glideFlight.ts), so what actually
// reaches the screen is a transform this code writes itself. glideFlight.test
// .ts proves the maths; this proves the maths is what the browser ends up
// rendering -- that the rAF loop runs, the element moves, and the flight
// reaches its target and hands over to the impact.
//
// The flight has been rebuilt twice after looking wrong in the app while the
// code read fine, which is what earns it a test at this level.

interface Sample {
  x: number;
  y: number;
  angle: number;
  scale: number;
}

/** Decomposes a computed `matrix(a,b,c,d,e,f)` into the parts we assert on. */
function parseMatrix(transform: string): Sample | null {
  const m = transform.match(/matrix\(([^)]+)\)/);
  if (!m) return null;
  const [a, b, , , e, f] = m[1].split(',').map(Number);
  return {
    x: e,
    y: f,
    angle: (Math.atan2(b, a) * 180) / Math.PI,
    scale: Math.hypot(a, b),
  };
}

test.describe('paper aeroplane flight', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'one browser is enough for a geometry check');
    await page.goto('/?visual-test=room&seats=8');
    await page.waitForSelector('.sp-app');
  });

  test('flies a smooth, continuous path to its target', async ({ page }) => {
    // Slow-mo stretches the 950ms flight so a 60fps sampler collects plenty of
    // frames, and makes any single-frame discontinuity impossible to miss.
    await page.getByTestId('toggle-slowmo').click();
    await expect(page.getByTestId('toggle-slowmo')).toHaveText('Slow-mo: 4x');
    await page.getByTestId('throw-all').click();

    // Sample the first plane's transform every animation frame while it flies.
    const samples = await page.evaluate<string[]>(() => {
      const el = document.querySelector('[data-testid="throw-layer"] > div') as HTMLElement | null;
      if (!el) return [];
      return new Promise<string[]>(resolve => {
        const out: string[] = [];
        const started = performance.now();
        const tick = () => {
          const t = getComputedStyle(el).transform;
          if (t && t !== 'none') out.push(t);
          // 4x slow-mo puts the flight at ~3.8s; stop a little short of the
          // handoff so the impact animation's own transform isn't mixed in.
          if (performance.now() - started < 3000) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      });
    });

    const poses = samples.map(parseMatrix).filter((p): p is Sample => p !== null);
    // A per-frame animation over ~3s should yield far more than a handful of
    // distinct positions -- a keyframe-free element that never moved, or a
    // loop that never ran, would fail here first.
    expect(poses.length).toBeGreaterThan(60);

    const first = poses[0];
    const last = poses[poses.length - 1];
    expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeGreaterThan(40);

    // No frame may jump disproportionately far compared to its neighbour.
    // This is the corner-detector: linear interpolation between waypoints
    // produced exactly this kind of spike at every stop.
    const steps = poses.slice(1).map((p, i) => Math.hypot(p.x - poses[i].x, p.y - poses[i].y));
    const moving = steps.filter(s => s > 0.05);
    for (let i = 1; i < moving.length; i++) {
      const ratio = Math.max(moving[i], moving[i - 1]) / Math.max(0.05, Math.min(moving[i], moving[i - 1]));
      expect(ratio, `frame ${i} stepped ${ratio.toFixed(1)}x its neighbour`).toBeLessThan(4);
    }

    // Attitude must never snap between frames -- the old keyframes flicked the
    // plane back ~14deg on the final frame to meet the impact animation.
    for (let i = 1; i < poses.length; i++) {
      let delta = Math.abs(poses[i].angle - poses[i - 1].angle);
      if (delta > 180) delta = 360 - delta;
      expect(delta, `attitude snapped ${delta.toFixed(1)}deg at frame ${i}`).toBeLessThan(15);
    }

    // The plane is flying away from the viewer: it must never balloon past
    // life size, which the previous version did on its way to scale(1.15).
    for (const p of poses) expect(p.scale).toBeLessThan(1.05);
  });

  test('every throw is cleaned up once it lands', async ({ page }) => {
    // The glide finishes from its own rAF loop rather than from animationend,
    // so the completion path that retires a throw is easy to break without
    // noticing -- planes would simply pile up in the DOM.
    const layer = page.locator('[data-testid="throw-layer"] > div');
    await page.getByTestId('throw-all').click();
    expect(await layer.count()).toBeGreaterThan(0);
    await expect(layer).toHaveCount(0, { timeout: 15000 });
  });

  test('respects prefers-reduced-motion', async ({ page }) => {
    // The flight is written from JS, so the CSS media query that silences the
    // ambient animations cannot reach it -- the preference has to be honoured
    // in the loop itself, and that is worth a test of its own.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?visual-test=room&seats=8');
    await page.waitForSelector('.sp-app');
    const layer = page.locator('[data-testid="throw-layer"] > div');
    await page.getByTestId('throw-all').click();
    // No long glide: it parks at the target and retires promptly.
    await expect(layer).toHaveCount(0, { timeout: 4000 });
  });
});
