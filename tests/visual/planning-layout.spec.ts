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
    await page.goto('/?visual-test=room&tickets=demo&controls=0&teamName=Trailblazers');
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
    // Each button sits on the side its drawer opens from.
    const middle = page.viewportSize()!.width / 2;
    const ticketsButton = (await page.getByRole('button', { name: /^Tickets/ }).boundingBox())!;
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
    await page.getByRole('button', { name: 'Tickets 6', exact: true }).click();
    const tickets = page.getByRole('dialog', { name: 'Tickets', exact: true });
    await expect(tickets).toHaveAttribute('data-side', 'right');
    await expect.poll(async () => { const box = (await tickets.boundingBox())!; return Math.round(box.x + box.width); }).toBe(page.viewportSize()!.width);
    expect((await tickets.boundingBox())!.height).toBe(page.viewportSize()!.height);
    await tickets.getByRole('button', { name: /^WEB-142 .*Keep filters/ }).click();
    await expect(tickets.getByRole('heading', { name: 'Keep filters when returning to search results' })).toBeVisible();
    await expect(tickets.getByRole('mark')).toHaveCount(2);
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

const jiraExport = [
  'Summary,Issue key,Issue Type,Status,Assignee,Reporter,Description',
  '"Keep filters, please",WEB-142,Story,Backlog,Ada Lovelace,Bo Ng,"Ask ada@example.com before changing the back button."',
  'Keyboard navigation in the account menu,WEB-148,Story,Ready,,,Arrow keys move between items.',
].join('\n');

const paste = (page: Page, text: string) => page.evaluate(value => {
  const data = new DataTransfer();
  data.setData('text/plain', value);
  document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
}, text);

test('a guest imports, edits and highlights tickets; only the creator brings one to the table', async ({ page }) => {
  await page.goto('/?visual-test=room&host=0');
  await page.getByRole('button', { name: 'Tickets', exact: true }).click();
  const tickets = page.getByRole('dialog', { name: 'Tickets', exact: true });
  await tickets.getByLabel('Paste tickets or drop a CSV').focus();
  await paste(page, jiraExport);
  const review = tickets.getByRole('region', { name: 'Review tickets' });
  await expect(review.getByText('2 tickets from a Jira export')).toBeVisible();
  await expect(review.getByText(/Assignee, Reporter and 2 other columns stay on this device/)).toBeVisible();
  await expect(review.getByText('Masked 1 email address in descriptions.')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('import-review.png') });
  await review.getByRole('button', { name: 'Add 2 tickets' }).click();
  await expect(tickets.getByRole('heading', { name: 'Keep filters, please' })).toBeVisible();
  await expect(tickets.getByText('Ask [email] before changing the back button.')).toBeVisible();
  await expect(tickets.getByText('Ada Lovelace')).toHaveCount(0);

  await tickets.getByRole('button', { name: 'Keep filters, please', exact: true }).click();
  await tickets.getByLabel('title', { exact: true }).fill('Keep filters when going back');
  await tickets.getByLabel('title', { exact: true }).press('Enter');
  await expect(tickets.getByText('You edited the title just now')).toBeVisible();

  await tickets.locator('.sp-ticket-description').evaluate(el => {
    const node = el.firstChild!;
    const start = node.textContent!.indexOf('back button');
    const range = document.createRange();
    range.setStart(node, start); range.setEnd(node, start + 'back button'.length);
    getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
  });
  // Selecting is highlighting: finishing the selection marks it.
  await tickets.locator('.sp-ticket-description').dispatchEvent('pointerup');
  await expect(tickets.getByRole('status')).toContainText('Highlighted for everyone');
  await expect(tickets.getByRole('mark')).toHaveText('back button');
  await tickets.getByRole('button', { name: 'Highlighted by you just now' }).click();
  await expect(tickets.getByRole('group', { name: 'Highlight' })).toContainText('Highlighted by you just now');
  await page.screenshot({ path: test.info().outputPath('ticket-attribution.png') });

  await expect(tickets.getByRole('button', { name: 'Start estimating' })).toHaveCount(0);
  await expect(tickets.getByText('The room creator brings tickets to the table.')).toBeVisible();
  await expect(tickets.getByRole('button', { name: 'Clear backlog' })).toHaveCount(0);

  // The same export again: what is already in the backlog is left unticked.
  await tickets.getByRole('button', { name: 'Add tickets' }).click();
  await tickets.getByLabel('Paste tickets or drop a CSV').focus();
  await paste(page, jiraExport);
  await expect(review.getByText('In backlog')).toHaveCount(2);
  await expect(review.getByRole('button', { name: 'Add 0 tickets' })).toBeDisabled();
  expect(await tickets.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
