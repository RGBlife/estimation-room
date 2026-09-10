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
    await pages[0].getByRole('button', { name: 'Nudge Player 2 to vote' }).click();
    await expect(pages[1].getByRole('status')).toContainText('Player 1 nudged you');
    await pages[0].evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      await (await import(path)).useRoomStore.getState().castVote('5');
    });
    await expect(pages[0].getByRole('button', { name: 'Reveal votes', exact: true })).toBeEnabled();
    const revealStarted = Date.now();
    await pages[0].getByRole('button', { name: 'Reveal votes', exact: true }).click();
    const revealTimes = await Promise.all(pages.map(async (page, i) => {
      await expect(i === 0 ? page.getByRole('button', { name: 'Start next round', exact: true })
        : page.getByText('Still time for your estimate', { exact: true })).toBeVisible();
      return Date.now() - revealStarted;
    }));
    console.info('Reveal visible on seven local clients (ms after click):', revealTimes);
    await testInfo.attach('reveal-latency-ms', { body: JSON.stringify(revealTimes), contentType: 'application/json' });
    await pages[1].getByRole('group', { name: 'Your vote' }).getByRole('button', { name: '8', exact: true }).click();
    await expect(pages[1].getByText('Still time for your estimate')).toHaveCount(0);
    await expect(pages[0].getByText('2/7 voted', { exact: true })).toBeVisible();
    await expect(pages[0].getByText('6.5', { exact: true })).toBeVisible();
    await expect(pages[0].getByRole('button', { name: 'Reveal votes', exact: true })).toHaveCount(0);
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

test('observer throws and avatar edits reach another participant', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const [host, observer] = await Promise.all(contexts.map(c => c.newPage()));
    await Promise.all([ready(host), ready(observer)]);
    await host.getByLabel('Your name', { exact: true }).fill('Host');
    await host.getByRole('button', { name: 'or create a new room' }).click();
    await host.getByRole('button', { name: 'Create room', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Customise your avatar' })).toBeVisible();
    const code = new URL(host.url()).searchParams.get('room')!;
    await observer.getByLabel('Your name', { exact: true }).fill('Observer');
    await observer.getByRole('button', { name: 'Observer', exact: true }).click();
    await observer.getByLabel('Room code', { exact: true }).fill(code);
    await observer.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(observer.getByText('Observer (you)', { exact: true })).toBeVisible();
    await host.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      const store = (await import(path)).useRoomStore;
      const seen = new Set<string>();
      (window as unknown as { received: string[] }).received = [];
      store.subscribe((state: { throws: { id: string; weaponId: string }[] }) => {
        for (const event of state.throws) if (!seen.has(event.id)) {
          seen.add(event.id);
          (window as unknown as { received: string[] }).received.push(event.weaponId);
        }
      });
    });
    for (const label of ['Peanut', 'Tomato', 'Spec document', 'Rubber chicken', 'Cheese', 'Stale pastry']) {
      await observer.getByRole('button', { name: /Choose Your Weapon/ }).click();
      await observer.getByRole('button', { name: label, exact: true }).click();
      await observer.getByRole('button', { name: 'Throw at Host', exact: true }).click();
      await observer.getByRole('button', { name: /Cancel throwing/ }).click();
    }
    await expect.poll(() => host.evaluate(() => (window as unknown as { received: string[] }).received)).toEqual([
      'peanut', 'tomato', 'spec-doc', 'rubber-chicken', 'cheese', 'stale-pastry',
    ]);
    await observer.getByRole('button', { name: 'Customise your avatar' }).click();
    const dialog = observer.getByRole('dialog', { name: 'Your look at the table' });
    await dialog.getByRole('button', { name: /Randomise/i }).click();
    await dialog.getByRole('button', { name: 'Save avatar' }).click();
    await expect(dialog).toHaveCount(0);
    const saved = await observer.evaluate(() => JSON.parse(localStorage.getItem('sp_profile')!).avatar);
    await expect.poll(() => host.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      const participants = (await import(path)).useRoomStore.getState().room.participants;
      return Object.values(participants as Record<string, { name: string }>).find(p => p.name === 'Observer');
    })).toMatchObject({ avatar: saved, isObserver: true, vote: null });
  } finally {
    await Promise.all(contexts.map(c => c.close()));
  }
});
