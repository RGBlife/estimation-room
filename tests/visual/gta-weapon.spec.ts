import { test, expect } from '@playwright/test';

// GTA Mode and weapon targeting must not be live at the same time: the tray
// is a full-screen z-50 scrim over a running physics loop, both read the same
// keys, and your own seat is invisible while driving yet still a click target.
test.describe('GTA Mode and weapon targeting', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'GTA Mode is hidden on touch devices');
    await page.goto('/?visual-test=room&seats=8&revealed=1');
    await page.waitForSelector('.sp-app');
  });

  test('the weapon button disables once driving starts', async ({ page }) => {
    const weapon = page.getByRole('button', { name: /Choose Your Weapon/ });
    await expect(weapon).toBeEnabled();
    await page.getByRole('button', { name: /GTA Mode/ }).click();
    await expect(page.getByTestId('drive-state')).toContainText('driving:yes');
    await expect(weapon).toBeDisabled();
  });

  test('starting a drive clears an already-equipped weapon', async ({ page }) => {
    await page.getByTestId('equip-weapon').click();
    await expect(page.getByTestId('drive-state')).toContainText('weapon:paper-airplane');

    await page.getByRole('button', { name: /GTA Mode/ }).click();
    // The other order of events: disabling the button alone would leave
    // targeting live for the whole drive.
    await expect(page.getByTestId('drive-state')).toContainText('weapon:none');
  });

  test('no seat is a throw target while driving', async ({ page }) => {
    await page.getByTestId('equip-weapon').click();
    expect(await page.getByRole('button', { name: /^Throw at/ }).count()).toBeGreaterThan(0);
    await page.getByRole('button', { name: /GTA Mode/ }).click();
    expect(await page.getByRole('button', { name: /^Throw at/ }).count()).toBe(0);
  });

  test('the weapon button comes back once the drive ends', async ({ page }) => {
    await page.getByRole('button', { name: /GTA Mode/ }).click();
    await page.getByTestId('stop-drive').click();
    await expect(page.getByRole('button', { name: /Choose Your Weapon/ })).toBeEnabled();
  });
});

// Deck changes are host-only, and the only cue that they're host-only is the
// deck control itself -- so the seat badge is how everyone else knows who to
// ask.
test.describe('host indication', () => {
  test('the host seat is badged, and only theirs', async ({ page }) => {
    await page.goto('/?visual-test=room&seats=6');
    await page.waitForSelector('.sp-app');
    const badges = page.getByText('Host', { exact: true });
    await expect(badges).toHaveCount(1);
  });

  test('the badge sits under the name, not above it', async ({ page }, info) => {
    // The bottom seat row is flex-col-reverse so vote cards sit nearest the
    // table, which flipped the badge above the name.
    test.skip(info.project.name === 'mobile', 'the phone grid has no reversed row');
    await page.goto('/?visual-test=room&seats=6');
    await page.waitForSelector('.sp-app');
    const badge = page.getByText('Host', { exact: true }).first();
    const name = page.getByText('Player 1 (you)').first();
    const [b, n] = await Promise.all([badge.boundingBox(), name.boundingBox()]);
    expect(b!.y, 'the Host badge renders above the name').toBeGreaterThan(n!.y);
  });

  test('a non-host sees the badge but gets no deck control', async ({ page }) => {
    await page.goto('/?visual-test=room&seats=6&host=0');
    await page.waitForSelector('.sp-app');
    await expect(page.getByText('Host', { exact: true })).toHaveCount(1);
    expect(await page.getByRole('button', { name: /Change the deck/ }).count()).toBe(0);
  });
});
