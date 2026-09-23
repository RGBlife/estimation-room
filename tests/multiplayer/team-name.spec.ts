import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/features/room/roomStore.ts';
    return !!(await import(path)).useRoomStore.getState().uid;
  })).toBe(true);
}

test('team names create, broadcast, rename, clear and refresh remembered cards', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const [host, guest] = await Promise.all(contexts.map(c => c.newPage()));
    await Promise.all([ready(host), ready(guest)]);
    await host.getByLabel('Your name', { exact: true }).fill('Host');
    await host.getByRole('button', { name: 'or create a new room' }).click();
    await host.getByLabel(/Team name/).fill('  Platform  ');
    await host.getByRole('button', { name: 'Create room', exact: true }).click();
    await expect(host).toHaveTitle(/Platform/);
    const code = await host.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      return (await import(path)).useRoomStore.getState().roomCode;
    });
    await guest.getByLabel('Your name', { exact: true }).fill('Guest');
    await guest.getByLabel('Room code', { exact: true }).fill(code);
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(guest).toHaveTitle(/Platform/);
    expect(await guest.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      try { await (await import(path)).useRoomStore.getState().renameRoom('Stolen'); return false; }
      catch { return true; }
    })).toBe(true);
    const rename = async (name: string) => {
      await host.getByRole('button', { name: /^Rename team|^Add a team name$/ }).click();
      await host.getByLabel(/Team name/).fill(name);
      await host.getByRole('button', { name: 'Save team name' }).click();
      await expect(host.getByRole('dialog', { name: 'Rename team' })).toBeHidden();
    };
    await rename('W'.repeat(40));
    await expect(guest).toHaveTitle(new RegExp('W'.repeat(40)));
    await guest.getByRole('button', { name: 'Leave room', exact: true }).click();
    await expect(guest.getByRole('button', { name: new RegExp(`Rejoin room ${code}.*${'W'.repeat(40)}`) })).toBeVisible();
    await rename('Renamed while away');
    await guest.reload();
    await expect(guest.getByRole('button', { name: new RegExp(`Rejoin room ${code}.*Renamed while away`) })).toBeVisible();
    await rename('  ');
    await expect(host).toHaveTitle(`${code} · Estimation Room`);
    await guest.reload();
    const card = guest.getByRole('button', { name: new RegExp(`Rejoin room ${code}`) });
    await expect(card).not.toHaveAccessibleName(/Renamed while away/);
    await card.click();
    await expect(guest).toHaveTitle(`${code} · Estimation Room`);
    await Promise.all([host, guest].map(p => p.getByRole('button', { name: 'Leave room', exact: true }).click()));
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
