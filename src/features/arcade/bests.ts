import type { DuelGame, DuelView } from '../../types/games.ts';
import { wpm } from './play/speed.ts';

// How you've done against the computer, kept in this browser: solo games pay
// no coins, so the record is your own. Wins and games for every game, and a
// personal best where there's something to time or count.
const KEY = 'sp_arcade_solo_v1';

export interface SoloRecord { played: number; won: number; best?: number }
type Records = Partial<Record<DuelGame, SoloRecord>>;

export function readRecords(): Records {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Records; } catch { return {}; }
}

// What a finished game is worth as a best, and whether lower is better.
export function bestOf(duel: DuelView, uid: string): { value: number; lower: boolean } | null {
  switch (duel.game) {
    case 'reaction': return duel.result?.winner === uid && duel.result.ms !== undefined ? { value: duel.result.ms, lower: true } : null;
    case 'typing': return duel.finished?.[uid] !== undefined && duel.text ? { value: wpm(duel.text.length, duel.finished[uid]), lower: false } : null;
    case 'words': return { value: duel.scores?.[uid] ?? 0, lower: false };
    default: return null;
  }
}

// Notes one finished game; returns the record as it now stands.
export function record(duel: DuelView, uid: string, fastest?: number): SoloRecord {
  const records = readRecords();
  const was = records[duel.game] ?? { played: 0, won: 0 };
  const next: SoloRecord = { ...was, played: was.played + 1, won: was.won + (duel.winner === uid ? 1 : 0) };
  const best = fastest !== undefined ? { value: fastest, lower: true } : bestOf(duel, uid);
  if (best && best.value > 0 && (was.best === undefined || (best.lower ? best.value < was.best : best.value > was.best))) next.best = best.value;
  try { localStorage.setItem(KEY, JSON.stringify({ ...records, [duel.game]: next })); } catch { /* A private window keeps no record. */ }
  return next;
}

// The record in a few words, for the game's card and page.
export function describe(game: DuelGame, record: SoloRecord | undefined): string | null {
  if (!record?.played) return null;
  const best = record.best === undefined ? null
    : game === 'reaction' ? `best ${record.best} ms`
    : game === 'typing' ? `best ${record.best} wpm`
    : game === 'words' ? `best ${record.best.toLocaleString('en-GB')} points`
    : null;
  return [`Beat the computer ${record.won} of ${record.played}`, best].filter(Boolean).join(' · ');
}

// Shorter, for a game's card on the Arcade's home: the best if there's one,
// otherwise the wins.
export function shortRecord(game: DuelGame, record: SoloRecord | undefined): string | null {
  if (!record?.played) return null;
  if (record.best !== undefined) return game === 'reaction' ? `Best ${record.best} ms` : game === 'typing' ? `Best ${record.best} wpm` : game === 'words' ? `Best ${record.best.toLocaleString('en-GB')}` : null;
  return `Beat the computer ${record.won} of ${record.played}`;
}
