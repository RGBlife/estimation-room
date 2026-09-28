import { expect, test, type Page } from '@playwright/test';

// The ready check floats at the table's left once there are criteria. Phones
// have no spare table for it, so there the strip's button is the way in.
async function checkFloatingChecklist(page: Page, theme: string) {
  const card = page.getByRole('region', { name: 'Ready check' });
  const pill = page.getByRole('button', { name: /^Show checklist/ });
  if (page.viewportSize()!.width <= 600) {
    await expect(card).toHaveCount(0);
    await expect(pill).toHaveCount(0);
    return;
  }
  if (await pill.isVisible()) await pill.click();
  await expect(card).toBeVisible();
  const box = (await card.boundingBox())!;
  expect(box.x + box.width).toBeLessThan(page.viewportSize()!.width / 2);
  await expect(card.getByRole('checkbox')).toHaveCount(4);
  await expect(card.getByRole('checkbox').first()).toBeChecked();
  await card.getByText('Acceptance criteria are testable').click();
  await expect(card.getByRole('checkbox').nth(1)).toBeChecked();
  await expect(page.getByRole('button', { name: 'Readiness 2/4' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath(`checklist-${theme}.png`) });
  await card.getByText('Acceptance criteria are testable').click();
  await expect(page.getByRole('button', { name: 'Readiness 1/4' })).toBeVisible();
  await card.getByRole('button', { name: 'Hide checklist' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show checklist, 1 of 4 ready' })).toBeVisible();
  await page.getByRole('button', { name: 'Show checklist, 1 of 4 ready' }).click();
  await card.getByRole('button', { name: 'Edit checklist' }).click();
  const drawer = page.getByRole('dialog', { name: 'Ticket readiness' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Close ticket readiness' }).click();
  await expect(drawer).toHaveCount(0);
}


for (const theme of ['light', 'dark']) {
  test(`readiness and ticket windows work in ${theme}`, async ({ page }) => {
    await page.goto('/?visual-test=room&jiraDemo=1&teamName=Trailblazers');
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
    // Each button sits on the side its drawer opens from.
    const middle = page.viewportSize()!.width / 2;
    const ticketsButton = (await page.getByRole('button', { name: 'Tickets', exact: true }).boundingBox())!;
    const readinessButton = (await page.getByRole('button', { name: /Readiness/ }).boundingBox())!;
    expect(readinessButton.x + readinessButton.width).toBeLessThan(middle);
    expect(ticketsButton.x).toBeGreaterThan(middle);
    await page.getByRole('button', { name: /Readiness/ }).click();
    const readiness = page.getByRole('dialog', { name: 'Ticket readiness' });
    await expect(readiness).toHaveAttribute('data-side', 'left');
    await expect.poll(async () => Math.round((await readiness.boundingBox())!.x)).toBe(0);
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
    await page.screenshot({ path: test.info().outputPath(`readiness-left-${theme}.png`) });
    await readiness.getByRole('button', { name: 'Close ticket readiness' }).click();
    await expect(page.getByRole('button', { name: /Readiness/ })).toBeFocused();
    await checkFloatingChecklist(page, theme);
    await page.getByRole('button', { name: 'Tickets', exact: true }).click();
    const tickets = page.getByRole('dialog', { name: 'Tickets', exact: true });
    await expect(tickets).toHaveAttribute('data-side', 'right');
    await expect.poll(async () => { const box = (await tickets.boundingBox())!; return Math.round(box.x + box.width); }).toBe(page.viewportSize()!.width);
    expect((await tickets.boundingBox())!.height).toBe(page.viewportSize()!.height);
    await tickets.getByLabel('Filter by team').selectOption('Web experience');
    await tickets.getByLabel('Filter by status').selectOption('Backlog');
    await tickets.getByRole('button', { name: /WEB-142/ }).click();
    await expect(tickets.getByRole('heading', { name: 'Keep filters when returning to search results' })).toBeVisible();
    expect(await tickets.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`tickets-right-${theme}.png`) });
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
