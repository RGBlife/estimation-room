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
