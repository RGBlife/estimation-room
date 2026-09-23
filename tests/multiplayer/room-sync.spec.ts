import { test, expect, type Page } from '@playwright/test';

const apiUrl = process.env.API_PROXY_TARGET || 'http://127.0.0.1:5050';
const testingFirebase = process.env.ROOM_TEST_BACKEND === 'firebase';

async function ready(page: Page) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/features/room/roomStore.ts';
    return !!(await import(path)).useRoomStore.getState().uid;
  }), { timeout: 30000 }).toBe(true);
}

// Every page has its own browser context and anonymous auth identity.
// All writes go to the local API.
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
    await Promise.all(pages.map(page => expect.poll(() => page.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      return Object.keys((await import(path)).useRoomStore.getState().room?.participants ?? {}).length === 7;
    }), { timeout: 30000 }).toBe(true)));
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
    await Promise.all(pages.map(page => expect.poll(() => page.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      return (await import(path)).useRoomStore.getState().tableCracks.length >= 21;
    }), { timeout: 30000 }).toBe(true)));
    await pages[0].waitForTimeout(800);
    await Promise.all(pages.map(page => expect(page.locator('[data-table-piece="left"]')).toBeVisible()));
    await pages[0].screenshot({ path: testInfo.outputPath('seven-player-broken-table.png') });
    await pages[0].getByRole('button', { name: 'Start next round', exact: true }).click();
    await Promise.all(pages.map(page => expect.poll(() => page.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      const state = (await import(path)).useRoomStore.getState();
      return !state.room.isRevealed && state.tableCracks.length === 0;
    }), { timeout: 30000 }).toBe(true)));
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

// Legacy profiles are normalized before sending to the API.
test('legacy avatar customisation no longer causes a permission-denied join', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const [host, guest] = await Promise.all(contexts.map(context => context.newPage()));
    await Promise.all([ready(host), ready(guest)]);
    const code = await host.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      const avatarPath = '/src/features/avatar/avatar.ts';
      return (await import(path)).useRoomStore.getState().createRoom({ name: 'Host', avatar: (await import(avatarPath)).randomAvatar(), isObserver: false, deck: 'fibonacci' });
    });
    const avatar = { seed: 'old', bgIdx: 2, glasses: true, earrings: false, flair: false, hairIdx: 12 };
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

test('all decks, role changes, reconnect and reuse of an empty room', async ({ browser }) => {
  test.skip(testingFirebase, 'Persistence and WebSocket reconnect policies belong to the .NET adapter.');
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    await contexts[1].addInitScript(() => {
      const NativeSocket = window.WebSocket;
      (window as unknown as { sockets: WebSocket[] }).sockets = [];
      window.WebSocket = class extends NativeSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          (window as unknown as { sockets: WebSocket[] }).sockets.push(this);
        }
      };
    });
    const [host, guest] = await Promise.all(contexts.map(c => c.newPage()));
    await Promise.all([ready(host), ready(guest)]);
    const code = await host.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts', avatarPath = '/src/features/avatar/avatar.ts';
      return (await import(path)).useRoomStore.getState().createRoom({ name: 'Host', avatar: (await import(avatarPath)).randomAvatar(), isObserver: false, deck: 'fibonacci' });
    });
    await guest.evaluate(async code => {
      const path = '/src/features/room/roomStore.ts', avatarPath = '/src/features/avatar/avatar.ts';
      await (await import(path)).useRoomStore.getState().joinRoom(code, { name: 'Guest', avatar: (await import(avatarPath)).randomAvatar(), isObserver: false, deck: 'fibonacci' });
    }, code);
    for (const [deck, value] of [['fibonacci', '13'], ['tshirt', 'XL'], ['powersOf2', '32'], ['rom', '10+'], ['custom', 'Needs a spike']]) {
      await host.evaluate(async ({ deck, value }) => {
        const path = '/src/features/room/roomStore.ts';
        const store = (await import(path)).useRoomStore.getState();
        await store.setDeck(deck); await store.castVote(value);
      }, { deck, value });
      await expect.poll(() => guest.evaluate(async () => {
        const path = '/src/features/room/roomStore.ts';
        const room = (await import(path)).useRoomStore.getState().room;
        return Object.values(room.participants as Record<string, { name: string; vote: string }>).find(p => p.name === 'Host')?.vote;
      })).toBe('voted');
      await host.evaluate(async () => { const path = '/src/features/room/roomStore.ts'; await (await import(path)).useRoomStore.getState().reveal(); });
      await expect(guest.getByText(value, { exact: true }).first()).toBeVisible();
    }
    await guest.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      const store = (await import(path)).useRoomStore.getState();
      await store.setRole(true);
      try { await store.castVote('No'); throw new Error('Observer vote was accepted'); }
      catch (error) { if (!(error instanceof Error) || !error.message.includes('Observers cannot vote')) throw error; }
      await store.setRole(false); await store.castVote('Reconnect estimate');
    });
    await guest.evaluate(() => (window as unknown as { sockets: WebSocket[] }).sockets.at(-1)!.close());
    await expect.poll(() => guest.evaluate(() => (window as unknown as { sockets: WebSocket[] }).sockets.length)).toBeGreaterThan(1);
    await expect.poll(() => guest.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts';
      const state = (await import(path)).useRoomStore.getState();
      return { error: state.error, vote: state.room.participants[state.uid].vote };
    })).toEqual({ error: null, vote: 'Reconnect estimate' });
    await Promise.all([host, guest].map(page => page.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts'; await (await import(path)).useRoomStore.getState().leave();
    })));
    await host.evaluate(async code => {
      const path = '/src/features/room/roomStore.ts', avatarPath = '/src/features/avatar/avatar.ts';
      await (await import(path)).useRoomStore.getState().joinRoom(code, { name: 'Returned', avatar: (await import(avatarPath)).randomAvatar(), isObserver: false, deck: 'fibonacci' });
    }, code);
    await expect(host.getByText('Returned (you)', { exact: true })).toBeVisible();
    await expect.poll(() => host.evaluate(async () => {
      const path = '/src/features/room/roomStore.ts'; return (await import(path)).useRoomStore.getState().room.deck;
    })).toBe('custom');
  } finally { await Promise.all(contexts.map(c => c.close())); }
});

test('health checks work and monitoring requires a separate credential', async ({ request }) => {
  test.skip(testingFirebase, 'The Firebase adapter has no custom monitoring endpoint.');
  expect((await request.get(`${apiUrl}/health/live`)).status()).toBe(200);
  expect((await request.get(`${apiUrl}/health/ready`)).status()).toBe(200);
  expect((await request.get(`${apiUrl}/metrics`)).status()).toBe(401);
  const response = await request.get(`${apiUrl}/metrics`, { headers: { Authorization: 'Bearer local-monitoring-only' } });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('scrum_database_writes_total');
});
