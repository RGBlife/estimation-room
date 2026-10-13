import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

// Every Arcade game as a duel through the room service: two players in a
// room, one challenges, the other accepts from the challenge card, and both
// play it out until it ends the same on both screens. The players are
// simple: any legal move in the turn games, taps and typing in the rest.
test.skip(process.env.ROOM_TEST_BACKEND === 'firebase', 'Duels are played on the room service');

const GAMES = ['reaction', 'typing', 'maths', 'pong', 'cycles', 'ultimate', 'connect', 'battleship', 'dots', 'words', 'mancala'] as const;
type Game = typeof GAMES[number];
const NAMES: Record<Game, RegExp> = {
  reaction: /^Reaction duel/, typing: /^Typing race/, maths: /^Speed maths/, pong: /^Pong/, cycles: /^Light cycles/,
  ultimate: /^Ultimate noughts/, connect: /^Connect Four/, battleship: /^Battleship/, dots: /^Dots and boxes/, words: /^Word Hunt/, mancala: /^Mancala/,
};

const WORDS = readFileSync(new URL('../../src/features/arcade/words/words.txt', import.meta.url), 'utf8').split('\n').filter(Boolean);
const WORD_SET = new Set(WORDS);
const PREFIXES = new Set(WORDS.flatMap(w => Array.from({ length: w.length }, (_, i) => w.slice(0, i + 1))));
function solve(grid: string[]): [string, number[]][] {
  const found = new Map<string, number[]>();
  const touching = (a: number, b: number) => a !== b && Math.abs(Math.floor(a / 4) - Math.floor(b / 4)) <= 1 && Math.abs(a % 4 - b % 4) <= 1;
  const walk = (cell: number, sofar: string, path: number[]) => {
    const word = sofar + grid[cell].toLowerCase();
    if (!PREFIXES.has(word)) return;
    const next = [...path, cell];
    if (word.length >= 3 && WORD_SET.has(word) && !found.has(word)) found.set(word, next);
    for (let n = 0; n < 16; n++) if (!next.includes(n) && touching(cell, n)) walk(n, word, next);
  };
  for (let c = 0; c < 16; c++) walk(c, '', []);
  return [...found].sort((a, b) => b[0].length - a[0].length);
}

async function ready(page: Page) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/features/room/roomStore.ts';
    const state = (await import(path)).useRoomStore.getState();
    return !!state.uid && !!state.profile;
  }), { timeout: 30000 }).toBe(true);
}
// Into a room by the store, as the other multiplayer specs do.
const enter = (page: Page, name: string, code?: string) => page.evaluate(async ({ name, code }) => {
  const path = '/src/features/room/roomStore.ts';
  const avatarPath = '/src/features/avatar/avatar.ts';
  const state = (await import(path)).useRoomStore.getState();
  const profile = { name, avatar: (await import(avatarPath)).randomAvatar(), isObserver: false, deck: 'fibonacci' };
  if (!code) return state.createRoom(profile) as Promise<string>;
  await state.joinRoom(code, profile);
  return code;
}, { name, code });
const voteAndReveal = (page: Page) => page.evaluate(async () => {
  const path = '/src/features/room/roomStore.ts';
  const state = (await import(path)).useRoomStore.getState();
  await state.castVote('5');
  await state.reveal();
});

const status = (page: Page) => page.locator('.sp-duel-status strong').first().textContent({ timeout: 300 }).catch(() => '');
const finished = async (page: Page) => /won|draw|resigned|ran out|left/i.test(await status(page) ?? '');
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
async function clickAny(page: Page, selector: string) {
  const enabled = [];
  for (const b of await page.locator(selector).all()) if (await b.isEnabled({ timeout: 300 }).catch(() => false)) enabled.push(b);
  if (enabled.length) await pick(enabled).click({ timeout: 1000 }).catch(() => {});
}

// One turn of play for one side. `lead` plays a little better, so the
// games that need a winner get one.
type State = { words?: [string, number[]][]; round?: string; typed?: boolean };
async function playOnce(game: Game, page: Page, lead: boolean, state: State) {
  switch (game) {
    case 'reaction': {
      const pad = page.locator('.sp-reaction-pad');
      if ((await pad.getAttribute('data-phase', { timeout: 300 }).catch(() => null)) === 'go') { if (!lead) await page.waitForTimeout(120); await pad.dispatchEvent('pointerdown'); }
      return;
    }
    case 'typing': {
      const input = page.getByRole('textbox', { name: 'Type the line' });
      if (state.typed || !(await input.isEnabled({ timeout: 300 }).catch(() => false))) return;
      state.typed = true;
      const text = await page.locator('.sp-typing-text').getAttribute('aria-label', { timeout: 500 }).catch(() => null);
      if (!text) return;
      await input.pressSequentially(text, { delay: lead ? 60 : 130 });
      return;
    }
    case 'maths': {
      const input = page.locator('.sp-maths-sum input');
      if (!(await input.isEnabled({ timeout: 300 }).catch(() => false))) return;
      const sum = await page.locator('.sp-maths-sum span').textContent({ timeout: 500 }).catch(() => null);
      if (!sum) return;
      const [a, op, b] = sum.replace('=', '').trim().split(' ');
      const answer = op === '+' ? +a + +b : op === '−' ? +a - +b : op === '×' ? +a * +b : +a / +b;
      if (!lead) await page.waitForTimeout(600);
      await input.fill(String(answer), { timeout: 500 }).catch(() => {});
      await input.press('Enter', { timeout: 500 }).catch(() => {});
      return;
    }
    case 'pong': {
      const box = await page.locator('.sp-pong-court canvas').boundingBox();
      if (box && lead) await page.mouse.move(box.x + box.width * (0.3 + Math.random() * 0.4), box.y + box.height * 0.9);
      return;
    }
    case 'cycles': {
      // The lead spirals inwards each round; the other rides straight into the wall.
      const round = await page.locator('.sp-cycles-arena canvas').getAttribute('aria-label', { timeout: 300 }).catch(() => null);
      const riding = (await page.locator('.sp-cycles-arena .sp-countdown').count()) === 0 && (await page.locator('.sp-cycles-result').count()) === 0;
      if (!lead || !round || !riding || state.round === round) return;
      state.round = round;
      for (const [key, wait] of [['ArrowUp', 500], ['ArrowRight', 500], ['ArrowDown', 500], ['ArrowLeft', 400], ['ArrowUp', 400], ['ArrowRight', 300], ['ArrowDown', 300]] as const) {
        await page.keyboard.press(key); await page.waitForTimeout(wait);
      }
      return;
    }
    case 'ultimate': return clickAny(page, '.sp-ultimate-square');
    case 'connect': return clickAny(page, '.sp-connect-column');
    case 'battleship': return clickAny(page, '.sp-sea-grid[data-target] .sp-sea-cell');
    case 'mancala': return clickAny(page, '.sp-mancala-row[data-side="near"] .sp-mancala-pit');
    case 'dots': {
      const gaps = await page.locator('.sp-dots-gap[aria-disabled="false"]').all();
      if (gaps.length) await pick(gaps).click({ timeout: 1000, force: true }).catch(() => {});
      return;
    }
    case 'words': {
      const tiles = page.locator('.sp-words-tile');
      if (!(await tiles.first().isEnabled({ timeout: 300 }).catch(() => false))) return;
      state.words ??= solve(await tiles.evaluateAll(ts => ts.map(t => (t.textContent ?? '').toUpperCase()))).slice(lead ? 0 : 3, lead ? 4 : 5);
      const next = state.words.shift();
      if (!next) return;
      const centre = async (cell: number) => { const b = (await tiles.nth(cell).boundingBox())!; return [b.x + b.width / 2, b.y + b.height / 2] as const; };
      const [x0, y0] = await centre(next[1][0]);
      await page.mouse.move(x0, y0); await page.mouse.down();
      for (const cell of next[1].slice(1)) { const [x, y] = await centre(cell); await page.mouse.move(x, y, { steps: 4 }); }
      await page.mouse.up();
      return;
    }
  }
}

for (const game of GAMES) {
  test(`${game}: challenged, accepted and played to the end through the room service`, async ({ browser }) => {
    test.setTimeout(game === 'pong' || game === 'words' ? 300_000 : 180_000);
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    try {
      const [host, guest] = await Promise.all(contexts.map(c => c.newPage()));
      await Promise.all([ready(host), ready(guest)]);
      const code = await enter(host, 'Hana');
      await enter(guest, 'Gus', code);
      await expect(host.getByText('Gus', { exact: true }).first()).toBeVisible();
      await voteAndReveal(host);

      // Hana challenges Gus from the game's page.
      await host.getByRole('button', { name: /^Arcade/ }).click();
      await host.getByRole('button', { name: NAMES[game] }).click();
      await host.getByRole('button', { name: /Challenge someone/ }).click();
      await host.getByRole('radio', { name: /Gus/ }).check();
      await host.getByRole('button', { name: 'Send challenge' }).click();
      // Gus accepts from the card in the corner, which opens the game.
      await guest.getByRole('button', { name: 'Accept' }).click();
      await expect(guest.locator(`[data-game-page="${game}"] .sp-duel`)).toBeVisible();
      await expect(host.locator(`[data-game-page="${game}"] .sp-duel`)).toBeVisible();

      const states: [State, State] = [{}, {}];
      const started = Date.now();
      while (!(await finished(host)) || !(await finished(guest))) {
        expect(Date.now() - started, `${game} should finish`).toBeLessThan(game === 'pong' || game === 'words' ? 260_000 : 160_000);
        // A move can race the end of the game; the next pass sees it's over.
        await Promise.all([playOnce(game, host, true, states[0]), playOnce(game, guest, false, states[1])].map(p => p.catch(() => {})));
        await host.waitForTimeout(game === 'reaction' ? 10 : 80);
      }
      // The same ending on both screens, from each side.
      const [hostSays, guestSays] = [await status(host), await status(guest)];
      if (/draw/.test(hostSays!)) expect(guestSays).toMatch(/draw/);
      else expect(new Set([/You won|You win/.test(hostSays!), /You won|You win/.test(guestSays!)]).size).toBe(2);
    } finally {
      await Promise.all(contexts.map(c => c.close()));
    }
  });
}
