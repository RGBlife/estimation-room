import { test, expect } from '@playwright/test';
import { checkOverflow } from './overflow.ts';

// The Toolbox and Sorted, against the ?visual-test=room harness and its
// stand-in game (src/dev/fakeSorted.ts), under every configured project.

test('the Toolbox waits for the reveal', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=6&controls=0');
  await page.getByRole('button', { name: 'Room menu' }).click();
  await expect(page.getByRole('menuitem', { name: /Toolbox/ })).toBeDisabled();
});

test('a Sorted board fits the window, and a solve pays into the balance', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&found=3');
  await page.getByRole('button', { name: 'Room menu' }).click();
  await page.getByRole('menuitem', { name: /Toolbox/ }).click();
  const toolbox = page.getByRole('dialog', { name: 'Toolbox' });
  await expect(toolbox.getByText('Sorted #1')).toBeVisible();
  const grid = toolbox.getByRole('group', { name: 'Tiles' });
  const overflow = await checkOverflow(grid);
  expect(overflow.overflowsHorizontally, JSON.stringify(overflow)).toBe(false);
  const box = (await toolbox.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  for (const tile of ['SCATTER', 'BEARD', 'PLANTED', 'BRAT']) await toolbox.getByRole('button', { name: tile, exact: true }).click();
  await toolbox.getByRole('button', { name: 'Submit' }).click();
  await expect(toolbox.getByText('Sorted, with no mistakes')).toBeVisible();
  await expect(toolbox.getByLabel('70 coins')).toBeVisible();
});
