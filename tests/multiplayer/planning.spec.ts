import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/features/room/roomStore.ts';
    return !!(await import(path)).useRoomStore.getState().uid;
  }), { timeout: 30000 }).toBe(true);
}

const paste = (page: Page, text: string) => page.evaluate(value => {
  const data = new DataTransfer();
  data.setData('text/plain', value);
  document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
}, text);

test('two browsers share readiness and a backlog, and estimate the selected ticket', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const [host, guest] = await Promise.all(contexts.map(c => c.newPage()));
    await Promise.all([ready(host), ready(guest)]);
    await host.getByLabel('Your name', { exact: true }).fill('Host');
    await guest.getByLabel('Your name', { exact: true }).fill('Guest');
    const code = await host.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      const avatar = '/src/features/avatar/avatar.ts';
      return (await import(path)).useRoomStore.getState().createRoom({ name: 'Host', avatar: (await import(avatar)).randomAvatar(), isObserver: false, deck: 'fibonacci' });
    });
    await guest.evaluate(async code => {
      const path = '/src/features/room/roomStore.ts';
      const avatar = '/src/features/avatar/avatar.ts';
      await (await import(path)).useRoomStore.getState().joinRoom(code, { name: 'Guest', avatar: (await import(avatar)).randomAvatar(), isObserver: false, deck: 'fibonacci' });
    }, code);
    await host.getByRole('button', { name: /Readiness/ }).click();
    await host.getByRole('button', { name: 'Use preset', exact: true }).click();
    await guest.getByRole('button', { name: /Readiness/ }).click();
    await expect(guest.getByRole('checkbox')).toHaveCount(4);
    // Independent edits arrive from different snapshots; both must survive.
    await Promise.all([host.getByRole('checkbox').nth(0).check(), guest.getByRole('checkbox').nth(1).check()]);
    await expect(host.getByRole('checkbox').nth(1)).toBeChecked();
    await expect(guest.getByRole('checkbox').nth(0)).toBeChecked();
    await host.getByLabel('Preset name', { exact: true }).fill('Across rooms');
    await host.getByRole('button', { name: 'Save preset' }).click();
    await expect(host.getByRole('status')).toHaveText('Preset saved on this device');
    await Promise.all([host, guest].map(p => p.getByRole('button', { name: 'Close ticket readiness' }).click()));
    await Promise.all([host, guest].map(p => p.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      await (await import(path)).useRoomStore.getState().castVote('5');
    })));
    await host.getByRole('button', { name: 'Reveal votes', exact: true }).click();

    // The host adds two tickets; the guest sees them arrive.
    await host.getByRole('button', { name: 'Tickets', exact: true }).click();
    const hostTickets = host.getByRole('dialog', { name: 'Tickets', exact: true });
    await hostTickets.getByLabel('Paste tickets or drop a CSV').focus();
    await paste(host, 'WEB-142 Keep filters when returning\nWEB-148 Keyboard navigation in the menu');
    await hostTickets.getByRole('button', { name: 'Add 2 tickets' }).click();
    await expect(guest.getByRole('button', { name: 'Tickets 2', exact: true })).toBeVisible();
    await hostTickets.getByRole('button', { name: 'Add a description' }).click();
    await hostTickets.getByLabel('Description').fill('Restore the search and the scroll position after going back.');
    await hostTickets.getByRole('button', { name: 'Save', exact: true }).click();

    // The guest edits and highlights; the host sees who did what.
    await guest.getByRole('button', { name: 'Tickets 2', exact: true }).click();
    const guestTickets = guest.getByRole('dialog', { name: 'Tickets', exact: true });
    await expect(guestTickets.getByText('Restore the search and the scroll position after going back.')).toBeVisible();
    await guestTickets.getByRole('button', { name: 'Keep filters when returning', exact: true }).click();
    await guestTickets.getByLabel('title', { exact: true }).fill('Keep filters after going back');
    await guestTickets.getByLabel('title', { exact: true }).press('Enter');
    await guestTickets.locator('.sp-ticket-description').evaluate(el => {
      const node = el.firstChild!;
      const start = node.textContent!.indexOf('scroll position');
      const range = document.createRange();
      range.setStart(node, start); range.setEnd(node, start + 'scroll position'.length);
      getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    });
    await guestTickets.locator('.sp-ticket-description').dispatchEvent('pointerup');
    await expect(hostTickets.getByRole('heading', { name: 'Keep filters after going back' })).toBeVisible();
    await expect(hostTickets.getByText('Guest edited the title')).toBeVisible();
    await expect(hostTickets.getByRole('mark')).toHaveText('scroll position');
    await expect(hostTickets.getByRole('button', { name: /^Highlighted by Guest/ })).toBeVisible();
    await expect(guestTickets.getByRole('button', { name: 'Start estimating' })).toHaveCount(0);
    await guestTickets.getByRole('button', { name: 'Close tickets' }).click();
    // Descriptions travel with the backlog, never in the room record.
    expect(await guest.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      return JSON.stringify((await import(path)).useRoomStore.getState().room);
    })).not.toContain('scroll position');

    await hostTickets.getByRole('button', { name: 'Start estimating', exact: true }).click();
    for (const p of [host, guest]) {
      await expect(p.getByRole('button', { name: 'WEB-142 Keep filters after going back', exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: 'Readiness 0/4' })).toBeVisible();
      await expect(p.getByRole('button', { name: 'Reveal votes', exact: true })).toBeDisabled();
    }
    expect(await guest.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      try { await (await import(path)).useRoomStore.getState().selectTicket(null); return false; } catch { return true; }
    }), { timeout: 30000 }).toBe(true);
    // A reveal with the ticket at the table records what the table agreed.
    await Promise.all([host, guest].map(p => p.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      await (await import(path)).useRoomStore.getState().castVote('8');
    })));
    await host.getByRole('button', { name: 'Reveal votes', exact: true }).click();
    await guest.getByRole('button', { name: 'Tickets 2', exact: true }).click();
    await expect(guest.getByRole('dialog', { name: 'Tickets', exact: true }).getByText('Estimated 8')).toBeVisible();
    await guest.getByRole('button', { name: 'Close tickets' }).click();
    await guest.reload();
    await expect(guest.getByRole('button', { name: 'WEB-142 Keep filters after going back', exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Tickets 2', exact: true })).toBeVisible();
    await Promise.all([host, guest].map(p => p.getByRole('button', { name: 'Leave room', exact: true }).click()));
    // Presets are device-wide: a different room gets the saved criteria.
    await host.getByRole('button', { name: 'or create a new room' }).click();
    await host.getByRole('button', { name: 'Create room', exact: true }).click();
    await host.getByRole('button', { name: /Readiness/ }).click();
    await host.getByLabel('Start from a preset').selectOption({ label: 'Across rooms' });
    await host.getByRole('button', { name: 'Use preset', exact: true }).click();
    await expect(host.getByRole('checkbox')).toHaveCount(4);
    await expect(host.getByRole('checkbox').nth(0)).not.toBeChecked();
    await host.getByRole('button', { name: 'Close ticket readiness' }).click();
    await host.getByRole('button', { name: 'Leave room', exact: true }).click();
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
