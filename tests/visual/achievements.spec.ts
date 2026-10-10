import { test, expect } from '@playwright/test';

// The achievement toast and drawer, against the ?visual-test=room harness,
// under every configured project (desktop, phone, tablet).

test('an achievement toast sits below the header, inside the viewport', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=6&controls=0&unlock=table-for-none');
  const toast = page.getByRole('status').filter({ hasText: 'Table for None' });
  await expect(toast).toBeVisible();
  // After the slide-in has settled.
  await page.waitForTimeout(400);
  const box = (await toast.boundingBox())!;
  const header = (await page.locator('.sp-room-header').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
});

test('your menu opens the achievements drawer', async ({ page }) => {
  await page.goto('/?visual-test=room&seats=6&controls=0&progress=3');
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await page.getByRole('menuitem', { name: /Achievements/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Achievements' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(/^3 of \d+ unlocked$/)).toBeVisible();
  // A secret stays a clue until it's earned.
  await expect(drawer.getByText("Some furniture isn't rated for this.")).toBeVisible();
  await expect(drawer.getByText('Table for None')).toHaveCount(0);
});
