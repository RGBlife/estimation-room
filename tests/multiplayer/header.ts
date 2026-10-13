import type { Page } from '@playwright/test';

// The room's settings live behind ⚙ (the room menu); your own things behind
// your avatar, which opens the editor directly where there's no progress
// (the Firebase build).
export const roomMenu = (page: Page) => page.getByRole('button', { name: 'Room menu', exact: true });

export async function leaveRoom(page: Page) {
  await roomMenu(page).click();
  await page.getByRole('menuitem', { name: 'Leave room', exact: true }).click();
}

export async function editAvatar(page: Page) {
  const you = page.getByRole('button', { name: 'You', exact: true });
  if (await you.count()) {
    await you.click();
    await page.getByRole('menuitem', { name: 'Edit avatar', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Customise your avatar' }).click();
  }
}
