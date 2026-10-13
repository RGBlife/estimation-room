import type { RareMove, RareView } from '../types/games.ts';

// Dev-only stand-in for the room service's Rare Find, so the question and
// result can be seen in the network-free harness. The real counting lives
// in the service (scrum-poker-backend RareFind.cs); these few fixture
// answers are from the category norms it uses.
const QUESTIONS: { category: string; prompt: string; answers: Record<string, number> }[] = [
  { category: 'fruit', prompt: 'Name a fruit', answers: { apple: 20, banana: 18, orange: 17, pear: 14, grape: 12, mango: 9, kiwi: 7, kumquat: 1, damson: 1, quince: 1, lychee: 1, 'star fruit': 1 } },
  { category: 'bird of prey', prompt: 'Name a bird of prey', answers: { eagle: 18, hawk: 16, falcon: 15, owl: 12, kestrel: 9, buzzard: 8, osprey: 4, harrier: 1, kite: 1, 'secretary bird': 1 } },
];
const PEOPLE = 20;

const pay = (count: number, total: number) => {
  if (count === 0) return 1;
  const share = count / total;
  return share <= 0.01 ? 20 : share <= 0.05 ? 15 : share <= 0.15 ? 10 : share <= 0.3 ? 5 : 2;
};

export function fakeRare(onCoins: (paid: number) => void) {
  let index = 0;
  let answered: Partial<RareView> | null = null;
  const view = (): RareView => {
    const q = QUESTIONS[index % QUESTIONS.length];
    const base = { category: q.category, number: index + 1, prompt: q.prompt, replay: false };
    if (!answered) return { ...base, asked: PEOPLE };
    const sorted = Object.entries(q.answers).map(([answer, count]) => ({ answer, count }));
    return {
      ...base, ...answered,
      common: sorted.slice(0, 3),
      rarest: sorted.filter(a => a.count === 1).slice(0, 5),
    };
  };
  return async (move: RareMove): Promise<RareView> => {
    if (move.operation === 'next') { index++; answered = null; }
    if (move.operation === 'answer') {
      const q = QUESTIONS[index % QUESTIONS.length];
      const key = move.answer.trim().toLowerCase().replace(/s$/, '');
      const count = q.answers[key] ?? 0;
      const paid = pay(count, PEOPLE);
      onCoins(paid);
      answered = { answer: move.answer.trim(), ...(count ? { match: key } : {}), count, total: PEOPLE, valid: count > 0, paid };
    }
    return view();
  };
}
