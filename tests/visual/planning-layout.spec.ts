import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`readiness and ticket windows work in ${theme}`, async ({ page }) => {
    await page.goto('/?visual-test=room&jiraDemo=1&teamName=Trailblazers');
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
    await page.getByRole('button', { name: /Readiness/ }).click();
    const readiness = page.getByRole('dialog', { name: 'Ticket readiness' });
    await expect(readiness).toHaveAttribute('data-side', 'right');
    await expect.poll(async () => { const box = (await readiness.boundingBox())!; return Math.round(box.x + box.width); }).toBe(page.viewportSize()!.width);
    expect((await readiness.boundingBox())!.height).toBe(page.viewportSize()!.height);
    await readiness.getByRole('button', { name: 'Use preset', exact: true }).click();
    await expect(readiness.getByRole('checkbox')).toHaveCount(4);
    await readiness.getByLabel('Criterion 1', { exact: true }).fill('Acceptance criteria agreed by the whole team');
    await readiness.getByLabel('Criterion 1', { exact: true }).press('Enter');
    await readiness.getByRole('checkbox').first().check();
    await readiness.getByLabel('Preset name', { exact: true }).fill('Our readiness');
    await readiness.getByRole('button', { name: 'Save preset' }).click();
    await expect(readiness.getByRole('status')).toHaveText('Preset saved on this device');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await readiness.evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: test.info().outputPath(`readiness-right-${theme}.png`) });
    await readiness.getByRole('button', { name: 'Close ticket readiness' }).click();
    await expect(page.getByRole('button', { name: /Readiness/ })).toBeFocused();
    await page.getByRole('button', { name: 'Tickets', exact: true }).click();
    const tickets = page.getByRole('dialog', { name: 'Tickets', exact: true });
    await expect(tickets).toHaveAttribute('data-side', 'left');
    await expect.poll(async () => Math.round((await tickets.boundingBox())!.x)).toBe(0);
    expect((await tickets.boundingBox())!.height).toBe(page.viewportSize()!.height);
    await tickets.getByLabel('Filter by team').selectOption('Web experience');
    await tickets.getByLabel('Filter by status').selectOption('Backlog');
    await tickets.getByRole('button', { name: /WEB-142/ }).click();
    await expect(tickets.getByRole('heading', { name: 'Keep filters when returning to search results' })).toBeVisible();
    expect(await tickets.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`tickets-left-${theme}.png`) });
    await tickets.getByRole('button', { name: 'Start estimating', exact: true }).click();
    await expect(tickets).toHaveCount(0);
    await expect(page.getByRole('button', { name: /WEB-142.*Keep filters/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Readiness 0/4' })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`selected-ticket-${theme}.png`), fullPage: true });
    await page.getByRole('button', { name: /Readiness/ }).click();
    await expect(page.getByLabel('Start from a preset').locator('option', { hasText: 'Our readiness' })).toHaveCount(1);
  });
}

test('Jira remains an honest connection placeholder until demo mode is enabled', async ({ page }) => {
  await page.goto('/?visual-test=room&host=0');
  await page.getByRole('button', { name: 'Tickets', exact: true }).click();
  await expect(page.getByText('Your backlog belongs here')).toBeVisible();
  await page.getByLabel('Use demo tickets').check();
  await page.getByLabel('Search tickets').fill('no matches');
  await expect(page.getByText('No matching tickets')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: /APP-83/ }).click();
  await expect(page.getByRole('button', { name: 'Start estimating' })).toHaveCount(0);
  await expect(page.getByText('The room creator chooses the ticket. Everyone can review it and vote.')).toBeVisible();
});
