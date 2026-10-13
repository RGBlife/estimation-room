import { test, expect } from '@playwright/test';
import { checkOverflow } from './overflow.ts';

// The Arcade and Sorted, against the ?visual-test=room harness and its
// stand-in game (src/dev/fakeSorted.ts), under every configured project.

test('the Arcade waits for the reveal', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=6&controls=0');
  await expect(page.getByRole('button', { name: 'Arcade, opens after the reveal' })).toHaveAttribute('aria-disabled', 'true');
});

test('a Sorted board fits the window, and a solve pays into the balance', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&found=3');
  await page.getByRole('button', { name: /^Arcade/ }).click();
  const arcade = page.getByRole('dialog', { name: 'Arcade' });
  await arcade.getByRole('button', { name: /^Sorted/ }).click();
  await expect(arcade.getByText('Sorted #1')).toBeVisible();
  const grid = arcade.getByRole('group', { name: 'Tiles' });
  const overflow = await checkOverflow(grid);
  expect(overflow.overflowsHorizontally, JSON.stringify(overflow)).toBe(false);
  const box = (await arcade.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  for (const tile of ['SCATTER', 'BEARD', 'PLANTED', 'BRAT']) await arcade.getByRole('button', { name: tile, exact: true }).click();
  await arcade.getByRole('button', { name: 'Submit' }).click();
  await expect(arcade.getByText('Sorted, with no mistakes')).toBeVisible();
  await expect(arcade.getByLabel('70 coins')).toBeVisible();
});

test('a challenge card opens the duel on the board', async ({ page }) => {
  // Still, so the card is measured where it lands rather than sliding in.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&duel=incoming');
  const card = page.getByRole('region', { name: 'Duel challenge' });
  await expect(card.getByText('Player 2 challenges you')).toBeVisible();
  const box = (await card.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  // On a phone the card folds into its pill after a few seconds; open it again if so.
  const pill = card.getByRole('button', { name: /challenges you/ });
  if (await pill.isVisible()) await pill.click();
  await card.getByRole('button', { name: 'Accept' }).click();
  const arcade = page.getByRole('dialog', { name: 'Arcade' });
  await expect(arcade.getByRole('group', { name: 'Boards' })).toBeVisible();
  await expect(card).toBeHidden();
  // Player 2 plays crosses first.
  await expect(arcade.getByRole('button', { name: /, X$/ })).toBeVisible();
  const overflow = await checkOverflow(arcade.getByRole('group', { name: 'Boards' }));
  expect(overflow.overflowsHorizontally, JSON.stringify(overflow)).toBe(false);
});

test('on a phone, the challenge folds into a pill off the table, and opens again', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&duel=incoming');
  const card = page.getByRole('region', { name: 'Duel challenge' });
  await expect(card.getByRole('button', { name: 'Accept' })).toBeVisible();
  await page.clock.runFor(4500);
  await expect(card.getByRole('button', { name: 'Accept' })).toBeHidden();
  // The pill stays in its corner, clear of the seats below it.
  const pill = (await card.boundingBox())!;
  const seat = (await page.getByText('Player 2', { exact: true }).first().boundingBox())!;
  expect(pill.x + pill.width).toBeLessThanOrEqual(390);
  expect(pill.y + pill.height).toBeLessThanOrEqual(seat.y);
  await card.getByRole('button', { name: /Player 2 challenges you/ }).click();
  await expect(card.getByRole('button', { name: 'Accept' })).toBeVisible();
});

test('ultimate noughts and crosses sends each move to the board it names', async ({ page }) => {
  // You opened in the centre, Player 2 answered in its corner: you're sent to the top left.
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&arcade=ultimate&duel=playing');
  const arcade = page.getByRole('dialog', { name: 'Arcade' });
  const board = (n: number) => arcade.getByRole('group', { name: new RegExp(`^Board ${n}(,|$)`) });
  await expect(board(1)).toHaveAccessibleName('Board 1, open');
  await expect(board(2).getByRole('button', { name: 'Square 1' })).toBeDisabled();
  await board(1).getByRole('button', { name: 'Square 3' }).click();
  // Square 3 sends Player 2 to board 3, where its O lands.
  await expect(board(3).getByRole('button', { name: /, O$/ })).toBeVisible();
  await expect(arcade.getByRole('status')).toContainText('Your move');
});

test('ultimate noughts and crosses keeps every square where it is as marks land', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&arcade=ultimate&duel=playing');
  const arcade = page.getByRole('dialog', { name: 'Arcade' });
  const squares = arcade.locator('.sp-ultimate-square');
  const places = () => squares.evaluateAll(all => all.map(e => { const r = e.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`; }));
  await expect(squares).toHaveCount(81);
  const before = await places();
  await arcade.getByRole('group', { name: /^Board 1,/ }).getByRole('button', { name: 'Square 3' }).click();
  await expect(arcade.getByRole('group', { name: /^Board 3/ }).getByRole('button', { name: /, O$/ })).toBeVisible();
  expect(await places()).toEqual(before);
});

test('a finished duel shows who won and what it paid', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&arcade=ultimate&duel=won');
  const arcade = page.getByRole('dialog', { name: 'Arcade' });
  await expect(arcade.getByRole('status')).toContainText('You won');
  await expect(arcade.getByRole('status')).toContainText('+55 coins');
  await expect(arcade.locator('.sp-noughts-win')).toBeVisible();
});

test('Rare Find asks, then shows how rare the answer was', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&arcade=rare');
  const arcade = page.getByRole('dialog', { name: 'Arcade' });
  await expect(arcade.getByText('Name a fruit')).toBeVisible();
  await arcade.getByLabel('Your answer').fill('Kumquats');
  await arcade.getByRole('button', { name: 'Answer' }).click();
  await expect(arcade.getByRole('status')).toContainText('1 of 20 people said that');
  await expect(arcade.getByLabel('60 coins')).toBeVisible();
  const overflow = await checkOverflow(arcade);
  expect(overflow.overflowsHorizontally, JSON.stringify(overflow)).toBe(false);
});

test('a Battleship duel fought to a win', async ({ page }) => {
  // Mid-game: you've hit two squares of a ship, and it's your shot.
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&arcade=battleship&duel=battleship');
  const arcade = page.getByRole('dialog', { name: 'Arcade' });
  const theirs = arcade.getByRole('group', { name: 'Their waters' });
  const overflow = await checkOverflow(arcade);
  expect(overflow.overflowsHorizontally, JSON.stringify(overflow)).toBe(false);
  await expect(arcade.getByRole('group', { name: 'Your fleet' }).getByRole('button', { name: 'A1, sunk' })).toBeVisible();
  // Every hit earns another shot, so these sink the rest of their fleet in a row.
  for (const square of ['D2', 'A4', 'A5', 'A6', 'E4', 'E5', 'F1', 'F2']) {
    await theirs.getByRole('button', { name: square, exact: true }).click();
    await expect(theirs.getByRole('button', { name: new RegExp(`^${square}, (hit|sunk)$`) })).toBeVisible();
  }
  await expect(arcade.getByRole('status')).toContainText('You won');
  await expect(arcade.getByLabel('100 coins')).toBeVisible();
});

test('the Arcade opens on a card per game, and a challenge to you comes first', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&arcade=open&duel=battleship-incoming');
  const arcade = page.getByRole('dialog', { name: 'Arcade' });
  await expect(arcade.getByText('Player 2 challenges you to Battleship')).toBeVisible();
  await expect(arcade.locator('.sp-arcade-card')).toHaveCount(13);
  const overflow = await checkOverflow(arcade);
  expect(overflow.overflowsHorizontally, JSON.stringify(overflow)).toBe(false);
  await arcade.getByRole('button', { name: 'Accept' }).click();
  await expect(arcade.getByRole('group', { name: 'Their waters' })).toBeVisible();
  await arcade.getByRole('button', { name: 'Arcade', exact: true }).click();
  await expect(arcade.getByRole('button', { name: /^Battleship/ })).toContainText('Your move');
});

// Every duel game, against the computer and against someone at the table:
// its board is on screen, fits the window, and the game gets going.
const GAMES = ['reaction', 'typing', 'maths', 'pong', 'cycles', 'ultimate', 'connect', 'battleship', 'dots', 'words', 'mancala'];
for (const game of GAMES) {
  test(`${game} plays against the computer and as a duel, and fits the window`, async ({ page }) => {
    const arcade = page.getByRole('dialog', { name: 'Arcade' });
    for (const duel of [false, true]) {
      await page.goto(`/?visual-test=room&seats=6&controls=0&revealed=1&coins=45&arcade=${game}${duel ? `&duel=play:${game}` : ''}`);
      if (!duel) await arcade.getByRole('button', { name: /Practise against the computer/ }).click();
      await expect(arcade.locator(`[data-game-page="${game}"] .sp-duel[data-game="${game}"]`)).toBeVisible();
      await expect(arcade.getByText(duel ? 'Player 2' : 'Computer', { exact: true }).first()).toBeVisible();
      const overflow = await checkOverflow(arcade);
      expect(overflow.overflowsHorizontally, JSON.stringify(overflow)).toBe(false);
    }
  });
}
