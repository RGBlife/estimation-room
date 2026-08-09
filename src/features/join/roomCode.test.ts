import { describe, it, expect } from 'vitest';
import { randomRoomCode } from './roomCode.ts';

describe('randomRoomCode', () => {
  it('produces 4 characters from the unambiguous letter set', () => {
    for (let i = 0; i < 200; i++) {
      expect(randomRoomCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    }
  });
});
