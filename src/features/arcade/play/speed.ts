// Words a minute, counting five characters a word. On its own so the
// Arcade's home can show a best typing speed without loading the games.
export const wpm = (chars: number, ms: number) => ms > 0 ? Math.round(chars / 5 / (ms / 60_000)) : 0;
