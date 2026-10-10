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

test('a challenge card opens the duel on the board', async ({ page }) => {
  // Still, so the card is measured where it lands rather than sliding in.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&duel=incoming');
  const card = page.getByRole('region', { name: 'Duel challenge' });
  await expect(card.getByText('Player 2 challenges you')).toBeVisible();
  const box = (await card.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await card.getByRole('button', { name: 'Accept' }).click();
  const toolbox = page.getByRole('dialog', { name: 'Toolbox' });
  await expect(toolbox.getByRole('group', { name: 'Board' })).toBeVisible();
  await expect(card).toBeHidden();
  // Player 2 plays crosses first, in the centre.
  await expect(toolbox.getByRole('button', { name: 'Square 5, X' })).toBeVisible();
  const overflow = await checkOverflow(toolbox.getByRole('group', { name: 'Board' }));
  expect(overflow.overflowsHorizontally, JSON.stringify(overflow)).toBe(false);
});

test('a duel played to a win', async ({ page }) => {
  // You hold X in the corner, Player 2 O in the centre, and it's your move.
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&toolbox=noughts&duel=playing');
  const toolbox = page.getByRole('dialog', { name: 'Toolbox' });
  const square = (n: number) => toolbox.getByRole('button', { name: new RegExp(`^Square ${n}`) });
  await square(9).click();
  await expect(square(3)).toHaveAccessibleName('Square 3, O');
  await square(7).click();
  await expect(square(2)).toHaveAccessibleName('Square 2, O');
  await square(4).click();
  await expect(toolbox.getByRole('status')).toContainText('You won');
  await expect(toolbox.getByLabel('100 coins')).toBeVisible();
});

test('Rare Find asks, then shows how rare the answer was', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&toolbox=rare');
  const toolbox = page.getByRole('dialog', { name: 'Toolbox' });
  await expect(toolbox.getByText('Name a fruit')).toBeVisible();
  await toolbox.getByLabel('Your answer').fill('Kumquats');
  await toolbox.getByRole('button', { name: 'Answer' }).click();
  await expect(toolbox.getByRole('status')).toContainText('1 of 20 people said that');
  await expect(toolbox.getByLabel('60 coins')).toBeVisible();
  const overflow = await checkOverflow(toolbox);
  expect(overflow.overflowsHorizontally, JSON.stringify(overflow)).toBe(false);
});

test('a Battleship duel fought to a win', async ({ page }) => {
  // Mid-game: you've hit two squares of a ship, and it's your shot.
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&toolbox=battleship&duel=battleship');
  const toolbox = page.getByRole('dialog', { name: 'Toolbox' });
  const theirs = toolbox.getByRole('group', { name: 'Their waters' });
  const overflow = await checkOverflow(toolbox);
  expect(overflow.overflowsHorizontally, JSON.stringify(overflow)).toBe(false);
  await expect(toolbox.getByRole('group', { name: 'Your fleet' }).getByRole('button', { name: 'A1, sunk' })).toBeVisible();
  // Every hit earns another shot, so these sink the rest of their fleet in a row.
  for (const square of ['D2', 'A4', 'A5', 'A6', 'E4', 'E5', 'F1', 'F2']) {
    await theirs.getByRole('button', { name: square, exact: true }).click();
    await expect(theirs.getByRole('button', { name: new RegExp(`^${square}, (hit|sunk)$`) })).toBeVisible();
  }
  await expect(toolbox.getByRole('status')).toContainText('You won');
  await expect(toolbox.getByLabel('100 coins')).toBeVisible();
});
