import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/?jiraDemo=1');
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/features/room/roomStore.ts';
    return !!(await import(path)).useRoomStore.getState().uid;
  })).toBe(true);
}

test('two browsers share readiness and estimate the selected ticket', async ({ browser }) => {
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
    await host.getByRole('button', { name: 'Tickets', exact: true }).click();
    await host.getByLabel('Filter by team').selectOption('Web experience');
    await host.getByLabel('Filter by status').selectOption('Backlog');
    await host.getByRole('button', { name: /WEB-142/ }).click();
    await host.getByRole('button', { name: 'Start estimating', exact: true }).click();
    for (const p of [host, guest]) {
      await expect(p.getByRole('button', { name: /WEB-142.*Keep filters/ })).toBeVisible();
      await expect(p.getByRole('button', { name: 'Readiness 0/4' })).toBeVisible();
      await expect(p.getByRole('button', { name: 'Reveal votes', exact: true })).toBeDisabled();
    }
    expect(await guest.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      try { await (await import(path)).useRoomStore.getState().selectTicket(null); return false; } catch { return true; }
    })).toBe(true);
    await guest.reload();
    await expect(guest.getByRole('button', { name: /WEB-142.*Keep filters/ })).toBeVisible();
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
