// The words Word Hunt accepts, the same list the room service checks against:
// SCOWL's common English words (size 50 and below, American and British
// spellings), three to sixteen letters, sorted. About 170KB over the wire,
// so it's fetched only when Word Hunt opens. See words/COPYRIGHT-SCOWL.txt.

let words: string[] | null = null;
let loading: Promise<string[]> | null = null;

export function loadWordList(): Promise<string[]> {
  loading ??= import('../words/words.txt?raw').then(module => (words = module.default.split('\n').filter(Boolean)));
  return loading;
}
export const wordListReady = () => words !== null;
// For tests: a list of your own.
export function setWordList(list: string[]) { words = [...list].sort(); loading = Promise.resolve(words); }

function list(): string[] {
  if (!words) throw new Error('The word list is still loading');
  return words;
}
function lowerBound(sorted: string[], word: string) {
  let low = 0, high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] < word) low = mid + 1; else high = mid;
  }
  return low;
}
export const isWord = (word: string) => { const all = list(); return all[lowerBound(all, word)] === word; };
// Whether any word starts with `prefix`.
export const startsWord = (prefix: string) => { const all = list(); return all[lowerBound(all, prefix)]?.startsWith(prefix) ?? false; };
