import { test, expect } from '@playwright/test';
import { checkOverflow } from './overflow.ts';

const DECKS = [
  { id: 'fibonacci', name: 'Fibonacci' },
  { id: 'tshirt', name: 'T-shirt' },
  { id: 'powersOf2', name: 'Powers of 2' },
  { id: 'rom', name: 'ROM' },
  { id: 'custom', name: 'Custom' },
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/?visual-test=cards');
});

for (const deck of DECKS) {
  test.describe(`${deck.name} deck`, () => {
    test.beforeEach(async ({ page }) => {
      await page.getByTestId(`select-deck-${deck.id}`).click();
    });

    if (deck.id !== 'custom') {
      test('no vote card clips its own text, in default or selected state', async ({ page }) => {
        const buttons = page.locator('button.font-sp-mono');
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
          const btn = buttons.nth(i);
          const label = await btn.textContent();
          // Click to select this card (exercises the lifted/selected state,
          // where the earlier clipping bug actually showed up), then check.
          await btn.click();
          const overflow = await checkOverflow(btn);
          expect(overflow.overflowsVertically, `"${label}" (${deck.name}) overflows its box vertically when selected: ${JSON.stringify(overflow)}`).toBe(false);
          expect(overflow.overflowsHorizontally, `"${label}" (${deck.name}) overflows its box horizontally when selected: ${JSON.stringify(overflow)}`).toBe(false);
        }
      });

    }

    test('revealed results view has no clipped text', async ({ page }) => {
      await page.getByTestId('toggle-reveal').click();
      await page.waitForTimeout(400); // exit-animation settle, matches VOTE_ROW_EXIT_MS

      // Check every visible text-bearing leaf in the voting bar's results
      // area, not just cards -- catches the mode/average summary and the
      // custom-results list rows too.
      const votingBar = page.locator('div.fixed.right-0.bottom-0.left-0');
      const overflow = await checkOverflow(votingBar);
      expect(overflow.overflowsVertically, `${deck.name} results view overflows the voting bar vertically: ${JSON.stringify(overflow)}`).toBe(false);
    });
  });
}

test('Custom deck: a short submitted answer displays in full, uncut', async ({ page }) => {
  await page.goto('/?visual-test=cards');
  await page.getByTestId('select-deck-custom').click();
  await page.getByPlaceholder(/^enter/i).fill('2 weeks');
  await page.getByText('Submit').click();
  await page.waitForTimeout(200);

  const lockedDisplay = page.locator('div.border-sp-accent.bg-sp-accent-panel').first();
  await expect(lockedDisplay).toHaveText('2 weeks');
  const overflow = await checkOverflow(lockedDisplay);
  expect(overflow.overflowsVertically, `Custom locked vote display overflows vertically: ${JSON.stringify(overflow)}`).toBe(false);
});

test('Custom deck: a long submitted answer truncates gracefully instead of breaking layout', async ({ page }) => {
  await page.goto('/?visual-test=cards');
  await page.getByTestId('select-deck-custom').click();
  await page.getByPlaceholder(/^enter/i).fill('This is a fairly long free-text estimate answer');
  await page.getByText('Submit').click();
  await page.waitForTimeout(200);

  const lockedDisplay = page.locator('div.border-sp-accent.bg-sp-accent-panel').first();
  await expect(lockedDisplay).toBeVisible();
  // The box itself must not grow to accommodate the long text (that would
  // push neighboring elements, e.g. the Change button, out of the row) --
  // it should truncate with an ellipsis instead. checkOverflow already
  // treats text-overflow:ellipsis truncation as expected, not a defect.
  const box = await lockedDisplay.boundingBox();
  const row = page.locator('.flex.w-full.max-w-\\[280px\\]').first();
  const rowBox = await row.boundingBox();
  expect(box && rowBox && box.width <= rowBox.width + 1, 'Custom locked display grew past its row instead of truncating').toBe(true);
  const overflow = await checkOverflow(lockedDisplay);
  expect(overflow.overflowsVertically, `Custom locked vote display overflows vertically: ${JSON.stringify(overflow)}`).toBe(false);
});
