import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await page.waitForFunction(async () => {
    const path = '/src/features/room/roomStore.ts';
    return !!(await import(path)).useRoomStore.getState().uid;
  });
}

// Every page has its own browser context and anonymous auth identity.
// All writes go to demo-scrum-poker emulators, never to the live project.
test('seven players reveal, nudge, drive and retain simultaneous table damage', async ({ browser }, testInfo) => {
  const contexts = await Promise.all(Array.from({ length: 7 }, () => browser.newContext()));
  try {
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    await Promise.all(pages.map(ready));
    const code = await pages[0].evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      const avatarPath = '/src/features/avatar/avatar.ts';
      return (await import(path)).useRoomStore.getState().createRoom({ name: 'Player 1', avatar: (await import(avatarPath)).randomAvatar(), isObserver: false, deck: 'fibonacci' });
    });
    await Promise.all(pages.slice(1).map((page, i) => page.evaluate(async ({ code, i }) => {
      const path = '/src/features/room/roomStore.ts';
      const avatarPath = '/src/features/avatar/avatar.ts';
      return (await import(path)).useRoomStore.getState().joinRoom(code, { name: `Player ${i + 2}`, avatar: (await import(avatarPath)).randomAvatar(), isObserver: false, deck: 'fibonacci' });
    }, { code, i })));
    await Promise.all(pages.map(page => page.waitForFunction(async () => {
      const path = '/src/features/room/roomStore.ts';
      return Object.keys((await import(path)).useRoomStore.getState().room?.participants ?? {}).length === 7;
    })));
    const targetUid = await pages[1].evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      return (await import(path)).useRoomStore.getState().uid;
    });
    await pages[0].getByRole('combobox', { name: 'Nudge a player who has not voted' }).selectOption(targetUid);
    await expect(pages[1].getByRole('status')).toContainText('Player 1 nudged you');
    await pages[0].evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      await (await import(path)).useRoomStore.getState().castVote('5');
    });
    await expect(pages[0].getByRole('button', { name: 'Reveal votes', exact: true })).toBeEnabled();
    const revealStarted = Date.now();
    await pages[0].getByRole('button', { name: 'Reveal votes', exact: true }).click();
    const revealTimes = await Promise.all(pages.map(async page => {
      await expect(page.getByRole('button', { name: 'Start next round', exact: true })).toBeVisible();
      return Date.now() - revealStarted;
    }));
    console.info('Reveal visible on seven local clients (ms after click):', revealTimes);
    await testInfo.attach('reveal-latency-ms', { body: JSON.stringify(revealTimes), contentType: 'application/json' });
    await Promise.all(pages.map(page => page.getByRole('button', { name: '🚗 GTA Mode', exact: true }).click()));
    await Promise.all(pages.map(page => expect(page.getByRole('button', { name: 'End drive', exact: true })).toBeVisible()));
    await Promise.all(pages.map(page => page.keyboard.down('w')));
    await pages[0].waitForTimeout(600);
    await Promise.all(pages.map(page => page.keyboard.up('w')));
    // Simultaneous impacts are deterministic here; driving input above still
    // exercises the live physics loop, position publishing and seven cars.
    await Promise.all(pages.map(page => page.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      const store = (await import(path)).useRoomStore.getState();
      for (let i = 0; i < 3; i++) store.publishCrack({ fx: .1 + i * .3, fy: .5, rot: 45, side: 'table' });
    })));
    await Promise.all(pages.map(page => page.waitForFunction(async () => {
      const path = '/src/features/room/roomStore.ts';
      return (await import(path)).useRoomStore.getState().tableCracks.length >= 21;
    })));
    await pages[0].waitForTimeout(800);
    await Promise.all(pages.map(page => expect(page.locator('[data-table-piece="left"]')).toBeVisible()));
    await pages[0].screenshot({ path: testInfo.outputPath('seven-player-broken-table.png') });
    await pages[0].getByRole('button', { name: 'Start next round', exact: true }).click();
    await Promise.all(pages.map(page => page.waitForFunction(async () => {
      const path = '/src/features/room/roomStore.ts';
      const state = (await import(path)).useRoomStore.getState();
      return !state.room.isRevealed && state.tableCracks.length === 0;
    })));
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

// Validate the actual rules, including the previously rejected avatar shape.
test('legacy avatar customisation no longer causes a permission-denied join', async ({ browser, request }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const [host, guest] = await Promise.all(contexts.map(context => context.newPage()));
    await Promise.all([ready(host), ready(guest)]);
    const code = await host.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      const avatarPath = '/src/features/avatar/avatar.ts';
      return (await import(path)).useRoomStore.getState().createRoom({ name: 'Host', avatar: (await import(avatarPath)).randomAvatar(), isObserver: false, deck: 'fibonacci' });
    });
    const { uid, token } = await guest.evaluate(async () => {
      const path = '/src/shared/lib/firebase.ts';
      const user = (await import(path)).auth.currentUser;
      return { uid: user.uid, token: await user.getIdToken() };
    });
    const avatar = { seed: 'old', bgIdx: 2, glasses: true, earrings: false, flair: false, hairIdx: 12 };
    function value(input: unknown): object {
      if (input === null) return { nullValue: null };
      if (typeof input === 'string') return { stringValue: input };
      if (typeof input === 'boolean') return { booleanValue: input };
      if (typeof input === 'number') return { integerValue: String(input) };
      return { mapValue: { fields: Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([key, item]) => [key, value(item)])) } };
    }
    const rejected = await request.patch(`http://127.0.0.1:8080/v1/projects/demo-scrum-poker/databases/(default)/documents/rooms/${code}?updateMask.fieldPaths=participants.${uid}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { fields: { participants: value({ [uid]: { name: 'Guest', avatar, isObserver: false, vote: null, joinedAt: 0 } }) } },
    });
    expect(rejected.status()).toBe(403);
    await guest.evaluate(async ({ code, avatar }) => {
      const path = '/src/features/room/roomStore.ts';
      await (await import(path)).useRoomStore.getState().joinRoom(code, { name: 'Guest', avatar, isObserver: false, deck: 'fibonacci' });
    }, { code, avatar });
    await expect(guest.getByText('Guest (you)', { exact: true })).toBeVisible();
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
