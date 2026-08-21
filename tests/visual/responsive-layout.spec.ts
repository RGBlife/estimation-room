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

    test('every participant is visible without scrolling', async ({ page }) => {
      // Phone-scoped. The desktop project runs at 1280x720, whose short
      // viewport plus the harness's own dev toolbar cannot fit a large room
      // either -- that predates this work and is a separate question from
      // the phone layout.
      test.skip(test.info().project.name === 'chromium', 'desktop viewport is height-constrained in the harness');
      // The reported symptom, stated as the outcome rather than as a fact
      // about rows: you should not have to scroll to see who is in the room.
      // Deliberately structure-agnostic -- it held for the old ringed-table
      // layout and holds for the phone grid that replaced it.
      const result = await page.evaluate((expected) => {
        const bar = document.querySelector('div.fixed.right-0.bottom-0.left-0')!.getBoundingClientRect();
        const avatars = Array.from(document.querySelectorAll('.sp-app img'))
          .map(i => i.getBoundingClientRect())
          .filter(b => b.width > 0 && b.height > 0);
        const visible = avatars.filter(b => b.top >= 0 && b.bottom <= bar.top + 1).length;
        return { visible, found: avatars.length, expected };
      }, seats);
      expect(
        result.visible,
        `only ${result.visible} of ${result.found} participants are visible above the voting bar`,
      ).toBeGreaterThanOrEqual(result.expected);
    });

    test('the page does not scroll vertically', async ({ page }) => {
      test.skip(test.info().project.name === 'chromium', 'desktop viewport is height-constrained in the harness');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );
      expect(overflow, `page scrolls by ${overflow}px`).toBeLessThanOrEqual(0);
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

test('header controls are big enough to tap', async ({ page }) => {
  // 44x44 is the usual minimum for a finger. The header used to shrink its
  // controls to fit instead: a 28x28 theme toggle and a 32x16 "Leave room".
  // Skipped on desktop, where a cursor is precise and the controls are
  // deliberately smaller.
  test.skip(test.info().project.name === 'chromium', 'pointer-precise, not a touch target');
  await page.goto('/?visual-test=room&seats=8');
  await page.waitForSelector('.sp-app');

  const tooSmall = await page.evaluate(() => {
    const header = document.querySelector('.sp-app > div')!;
    return Array.from(header.querySelectorAll('button'))
      .map(b => ({ label: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 24), box: b.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0)
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ label, box }) => `${label} (${Math.round(box.width)}x${Math.round(box.height)})`);
  });
  expect(tooSmall, `controls under 44x44: ${tooSmall.join(', ')}`).toEqual([]);
});

test('the room menu opens with full-size rows', async ({ page }) => {
  // Phone-only by design: a tablet has room to show every control at full
  // size, so it keeps them inline rather than behind a menu.
  test.skip(test.info().project.name !== 'mobile', 'the menu is phone-only');
  await page.goto('/?visual-test=room&seats=8');
  await page.getByLabel('Room menu').click();
  await page.waitForTimeout(250);

  const items = page.locator('[role="menuitem"]');
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await items.nth(i).boundingBox();
    expect(box!.height, `menu row ${i} is ${Math.round(box!.height)}px tall`).toBeGreaterThanOrEqual(44);
  }
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
