import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`join and avatar customisation fit the viewport in ${theme} mode`, async ({ page }) => {
    await page.goto('/?visual-test=join');
    await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
    await expect(page.getByRole('heading', { name: 'Take a seat' })).toBeVisible();
    await page.getByLabel('Your name', { exact: true }).fill('Sam');
    await page.getByLabel('Room code', { exact: true }).fill('ABCD');
    await expect(page.getByRole('button', { name: 'Join room', exact: true })).toBeEnabled();
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(await fits()).toBe(true);
    await page.waitForTimeout(450);
    await page.screenshot({ path: test.info().outputPath(`join-${theme}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Customise' }).click();
    await page.waitForTimeout(350);
    expect(await fits()).toBe(true);
    await page.screenshot({ path: test.info().outputPath('avatar-expanded.png'), fullPage: true });
    await page.getByRole('button', { name: 'or create a new room' }).click();
    await expect(page.getByRole('button', { name: 'Create room', exact: true })).toBeEnabled();
    expect(await fits()).toBe(true);
    const inputSize = await page.getByLabel('Your name', { exact: true }).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    if (page.viewportSize()!.width < 560) expect(inputSize).toBeGreaterThanOrEqual(16);
  });
}

test('voting cards remain usable after the surface refresh', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=8');
  await expect(page.getByRole('button', { name: 'Reveal votes', exact: true })).toBeVisible();
  const card = page.getByRole('group', { name: 'Your vote' }).getByRole('button').first();
  expect((await card.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: test.info().outputPath('room.png'), fullPage: true });
});

test('local preview shows ten players and four observers', async ({ page }) => {
  await page.goto('/?visual-test=join');
  await page.getByRole('link', { name: 'Preview 10 players and 4 observers' }).click();
  await expect(page).toHaveURL(/seats=10&observers=4/);
  await expect(page.getByText('Player 1 (you)', { exact: true })).toBeVisible();
  await expect(page.getByText('Player 10', { exact: true })).toBeVisible();
  for (let i = 11; i <= 14; i++) await expect(page.getByText(`Player ${i}`, { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('ten-players-four-observers.png'), fullPage: true });
});
