import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/features/room/roomStore.ts';
    return !!(await import(path)).useRoomStore.getState().uid;
  }), { timeout: 30000 }).toBe(true);
}

// A host who creates a room ahead of the meeting and steps out must find it
// still open: the last person leaving used to delete it on Firebase, so it
// showed as closed in everyone's recent rooms and the shared link was dead.
test('a room everyone has left stays open and can be rejoined', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const [host, guest] = await Promise.all(contexts.map(c => c.newPage()));
    await Promise.all([ready(host), ready(guest)]);
    await host.getByLabel('Your name', { exact: true }).fill('Casey');
    await host.getByRole('button', { name: 'or create a new room' }).click();
    await host.getByRole('button', { name: 'Create room', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Leave room', exact: true })).toBeVisible();
    const code = await host.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      return (await import(path)).useRoomStore.getState().roomCode as string;
    });

    await host.getByRole('button', { name: 'Leave room', exact: true }).click();
    // Back on the join screen first: until the leave lands, the address bar
    // still carries ?room=, and reloading then rejoins through the link.
    await expect(host).not.toHaveURL(/room=/);
    await host.reload();
    const card = host.getByRole('button', { name: new RegExp(`Rejoin room ${code}`) });
    await expect(card).toBeVisible();
    await expect(host.getByRole('button', { name: new RegExp(`Room ${code} is closed`) })).toHaveCount(0);

    // Someone else can still come in by the code, and so can the host.
    await guest.getByLabel('Your name', { exact: true }).fill('Guest');
    await guest.getByLabel('Room code', { exact: true }).fill(code);
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(guest.getByRole('button', { name: 'Leave room', exact: true })).toBeVisible();
    await card.click();
    await expect(host.getByText('Guest', { exact: true })).toBeVisible();
    await expect(guest.getByText('Casey', { exact: true })).toBeVisible();
    await Promise.all([host, guest].map(p => p.getByRole('button', { name: 'Leave room', exact: true }).click()));
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
