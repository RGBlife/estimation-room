import { test, expect } from '@playwright/test';
import { checkOverflow } from './overflow.ts';

// Layout regressions at phone/tablet width, against the Firestore-free
// ?visual-test=room harness (src/dev/RoomLayoutHarness.tsx) which composes
// header + seats + table + voting bar the way RoomScreen does.
//
// These run under every configured project (see playwright.config.ts), so the
// same assertions cover desktop, iPhone 14 (390px) and iPad (768px). The bugs
// they pin were only ever visible on the narrow two.

const ROOM_SIZES = [4, 8, 12];

async function documentScrollsHorizontally(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

for (const seats of ROOM_SIZES) {
  test.describe(`${seats}-person room`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/?visual-test=room&seats=${seats}`);
      await page.waitForSelector('.sp-app');
    });

    test('the page never scrolls sideways', async ({ page }) => {
      // The most user-visible symptom: one too-wide element turns the whole
      // document into a horizontal scroller and the layout reads as broken.
      expect(await documentScrollsHorizontally(page)).toBe(false);
    });

    test('every seat row fits its container', async ({ page }) => {
      const rows = page.locator('.sp-app .flex.flex-wrap.justify-center');
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const overflow = await checkOverflow(rows.nth(i));
        expect(
          overflow.overflowsHorizontally,
          `seat row ${i} overflows horizontally: ${JSON.stringify(overflow)}`,
        ).toBe(false);
      }
    });

    test('seats do not fragment into a stack of short rows', async ({ page }) => {
      // The actual reported symptom, and the one an overflow check misses
      // entirely: the seat rows are flex-wrap, so oversized seats never
      // "overflow" -- they silently wrap into many rows of one or two people,
      // which is what reads as everything being crammed together.
      //
      // Measured by distinct vertical positions of the seat elements: with
      // seats sized for the viewport, a top/bottom row should each occupy one
      // or two lines, not four or five.
      // Scoped to the seat stage specifically -- the voting bar's own card
      // row is also a wrapping flex row and would otherwise be counted as
      // seats, which says nothing about seat crowding.
      const lines = await page.evaluate(() => {
        const bar = document.querySelector('div.fixed.right-0.bottom-0.left-0');
        const rows = Array.from(document.querySelectorAll('.sp-app .flex.flex-wrap.justify-center'))
          .filter(r => !bar || !bar.contains(r));
        let total = 0;
        for (const row of rows) {
          const tops = new Set<number>();
          for (const child of Array.from(row.children)) {
            const box = child.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) continue;
            tops.add(Math.round(box.top / 12) * 12); // absorb sub-pixel drift
          }
          total += tops.size;
        }
        return total;
      });
      // Two nominal rows (above and below the table), each allowed to wrap
      // once.
      expect(lines, `seats occupy ${lines} distinct lines`).toBeLessThanOrEqual(4);
    });

    test('seats are sized for the viewport, not the desktop default', async ({ page }) => {
      // Line count alone is not enough: on the pre-fix layout 96px seats also
      // wrapped to two lines, they just fit three per line instead of five.
      // What actually differed -- and what read as crowding -- is that seats
      // were never resized for the screen at all. Assert a full row's worth
      // fits the stage, which is the property the size tier exists to hold.
      const fits = await page.evaluate(() => {
        const bar = document.querySelector('div.fixed.right-0.bottom-0.left-0');
        const row = Array.from(document.querySelectorAll('.sp-app .flex.flex-wrap.justify-center'))
          .filter(r => !bar || !bar.contains(r))[0];
        if (!row) return null;
        const kids = Array.from(row.children).filter(c => c.getBoundingClientRect().width > 0);
        if (!kids.length) return null;
        const seatW = kids[0].getBoundingClientRect().width;
        const rowW = row.getBoundingClientRect().width;
        return { seatW, rowW, perLine: Math.floor((rowW + 8) / (seatW + 8)) };
      });
      expect(fits).not.toBeNull();
      // At 390px (358px of stage) a phone-tier seat gives 5 per line; the
      // desktop 96px default gives 3.
      expect(
        fits!.perLine,
        `only ${fits!.perLine} seats fit per line (seat ${Math.round(fits!.seatW)}px in ${Math.round(fits!.rowW)}px)`,
      ).toBeGreaterThanOrEqual(4);
    });

    test('the voting bar leaves the table something to occupy', async ({ page }) => {
      // The bar is fixed and used to grow without bound; SeatTable reserves
      // matching clearance, so an unbounded bar pushed the table off screen.
      const bar = page.locator('div.fixed.right-0.bottom-0.left-0');
      const barBox = await bar.boundingBox();
      const viewport = page.viewportSize();
      expect(barBox && viewport).toBeTruthy();
      expect(
        barBox!.height,
        `voting bar takes ${Math.round((barBox!.height / viewport!.height) * 100)}% of the viewport`,
      ).toBeLessThan(viewport!.height * 0.6);
    });

    test('revealed: every seat stays reachable behind the results panel', async ({ page }) => {
      await page.getByTestId('toggle-reveal').click();
      await page.waitForTimeout(400);
      // The stage is justify-center, which overflows at *both* ends once
      // content plus the bar's clearance exceeds the viewport -- the bottom
      // seat row vanished behind the bar with no way to scroll to it. Either
      // the seats clear the bar, or the page scrolls far enough to reach them.
      const reachable = await page.evaluate(() => {
        const bar = document.querySelector('div.fixed.right-0.bottom-0.left-0')!.getBoundingClientRect();
        const seats = Array.from(document.querySelectorAll('.sp-app img'))
          .map(i => i.getBoundingClientRect().bottom)
          .filter(b => b > 0);
        if (!seats.length) return true;
        const lowest = Math.max(...seats);
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        return lowest <= bar.top + 1 || scrollable > 0;
      });
      expect(reachable, 'the bottom seat row is hidden behind the voting bar and cannot be scrolled to').toBe(true);
    });

    test('revealed: the results panel still leaves the table room', async ({ page }) => {
      await page.getByTestId('toggle-reveal').click();
      await page.waitForTimeout(400); // exit-animation settle, matches VOTE_ROW_EXIT_MS

      expect(await documentScrollsHorizontally(page)).toBe(false);

      const bar = page.locator('div.fixed.right-0.bottom-0.left-0');
      const barBox = await bar.boundingBox();
      const viewport = page.viewportSize();
      expect(
        barBox!.height,
        `revealed voting bar takes ${Math.round((barBox!.height / viewport!.height) * 100)}% of the viewport`,
      ).toBeLessThan(viewport!.height * 0.6);
    });
  });
}

test('the toast clears the voting bar instead of rendering inside it', async ({ page }) => {
  // The toast used to sit at a hardcoded bottom-24 (96px), which lands inside
  // the bar as soon as it wraps to a second row -- which it does on a phone.
  await page.goto('/?visual-test=room&seats=8');
  await page.getByTestId('toggle-toast').click();
  await page.waitForTimeout(350); // toast fade-in

  const toast = page.locator('div.fixed.z-40').first();
  await expect(toast).toBeVisible();
  const bar = page.locator('div.fixed.right-0.bottom-0.left-0');

  const [toastBox, barBox] = await Promise.all([toast.boundingBox(), bar.boundingBox()]);
  expect(toastBox && barBox).toBeTruthy();
  expect(
    toastBox!.y + toastBox!.height <= barBox!.y + 1,
    `toast (bottom ${Math.round(toastBox!.y + toastBox!.height)}) overlaps the voting bar (top ${Math.round(barBox!.y)})`,
  ).toBe(true);
});

test('a long toast message stays within the viewport', async ({ page }) => {
  // It was whitespace-nowrap with no max-width and centred with left-1/2, so
  // the ~55-character deck-switch message bled off both edges -- and being
  // fixed, the overflow could not be scrolled to.
  await page.goto('/?visual-test=room&seats=8');
  await page.getByTestId('toggle-toast').click();
  await page.waitForTimeout(350);

  const toast = page.locator('div.fixed.z-40').first();
  const box = await toast.boundingBox();
  const viewport = page.viewportSize();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(
    box!.x + box!.width,
    `toast right edge ${Math.round(box!.x + box!.width)} exceeds viewport ${viewport!.width}`,
  ).toBeLessThanOrEqual(viewport!.width + 1);
});

test('the header stays a reasonable share of the screen', async ({ page }) => {
  // min-w-[280px] plus six nowrap buttons stacked the header several rows
  // tall on a phone, pushing everything else off the fold.
  await page.goto('/?visual-test=room&seats=8');
  await page.waitForSelector('.sp-app');

  const header = page.locator('.sp-app > div').first();
  const box = await header.boundingBox();
  // An absolute ceiling rather than a share of the viewport: the failure is
  // the control group stacking one nowrap button per row, which is ~5 rows of
  // ~40px. Two rows is fine; anything approaching 150px is the tower.
  expect(box!.height, `header is ${Math.round(box!.height)}px tall`).toBeLessThan(120);
});
