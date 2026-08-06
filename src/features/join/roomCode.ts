const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function randomRoomCode() {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return out;
}
