import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { participantAvatarSrc } from '../avatar/index.js';
import DuelFrame from './DuelFrame.tsx';
import { DUEL_GAMES, whoIsFree } from './catalogue.ts';
import { describe, readRecords, record } from './bests.ts';
import { isBusy, isLive, ownDuel } from './duels.ts';
import { loadWordList } from './play/wordList.ts';
import { COMPUTER, LocalDuel } from './play/local.ts';
import type { Participant } from '../../types/room.ts';
import { KINDS } from './play/typing.ts';
import type { DuelGame, DuelMove, DuelOptions, DuelPlay, DuelSteer, DuelView, TypingKind } from '../../types/games.ts';

const STAKE_STEP = 5;
// Each game against the computer is a new duel, with an id of its own.
let practised = 0;

const KIND_NAMES: Record<TypingKind, string> = { code: 'Code', story: 'Story', quotes: 'Famous quote', words: 'Common words' };
const KIND_KEY = 'sp_arcade_typing_kind_v1';
const savedKind = (): TypingKind => { try { const kind = localStorage.getItem(KIND_KEY); return KINDS.includes(kind as TypingKind) ? kind as TypingKind : 'code'; } catch { return 'code'; } };

// What a typing race types, picked before it starts (or with the challenge).
function KindPicker({ kind, onPick }: { kind: TypingKind; onPick: (kind: TypingKind) => void }) {
  return (
    <fieldset className="sp-game-kind">
      <legend>What to type</legend>
      {KINDS.map(k => (
        <label key={k}>
          <input type="radio" name="sp-typing-kind" value={k} checked={kind === k} onChange={() => { onPick(k); try { localStorage.setItem(KIND_KEY, k); } catch { /* remembered for this visit only */ } }} />
          <span>{KIND_NAMES[k]}</span>
        </label>
      ))}
    </fieldset>
  );
}

// The games against the computer, kept by the Arcade while it's open and
// between rounds, so closing the window pauses a game rather than losing it.
export interface SoloGames {
  get: (game: DuelGame) => LocalDuel | undefined;
  keep: (game: DuelGame, local: LocalDuel) => void;
  drop: (game: DuelGame) => void;
}

interface GamePageProps {
  game: DuelGame;
  uid: string | null;
  coins: number;
  participants: Record<string, Participant>;
  duels: DuelView[];
  duel: (move: DuelMove) => Promise<void>;
  steer: (id: string, input: DuelSteer) => void;
  solo: SoloGames;
}

// You against the computer. It plays on the duel clock while the window's
// open; closed, the game waits. A finished game goes in your record.
function SoloGame({ game, uid, participants, solo, options, onBack }: { game: DuelGame; uid: string; participants: Record<string, Participant>; solo: SoloGames; options?: DuelOptions; onBack: () => void }) {
  const start = useCallback(() => {
    const local = new LocalDuel(game, { uid, name: participants[uid]?.name ?? 'You' }, COMPUTER, COMPUTER.uid, { id: `solo-${game}-${++practised}`, options });
    solo.keep(game, local);
    return local;
  }, [game, uid, participants, solo, options]);
  // Word Hunt's grid needs the word list before it can be rolled.
  const [local, setLocal] = useState<LocalDuel | null>(() => solo.get(game) ?? (game === 'words' ? null : start()));
  useEffect(() => {
    if (local) return;
    let gone = false;
    void loadWordList().then(() => { if (!gone) setLocal(start()); });
    return () => { gone = true; };
  }, [local, start]);
  useSyncExternalStore(useCallback(listener => local?.subscribe(listener) ?? (() => {}), [local]), () => local?.version ?? -1);
  useEffect(() => {
    if (!local) return;
    local.resume();
    const stop = local.run();
    return () => { stop(); local.pause(); };
  }, [local]);
  // Your quickest winning tap, for the reaction record.
  const [fastest, setFastest] = useState<number | undefined>();
  const [best, setBest] = useState<string | null>(null);
  const view = local?.view(uid);
  const result = view?.result;
  useEffect(() => {
    if (result?.winner === uid && result.ms !== undefined) setFastest(f => Math.min(f ?? Infinity, result.ms!));
  }, [result, uid]);
  const over = !!view && view.status !== 'playing';
  useEffect(() => {
    if (!over || !view || !local || local.recorded) return;
    local.recorded = true;
    setBest(describe(game, record(view, uid, fastest)));
  }, [over, view, local, game, uid, fastest]);

  if (!local || !view) return <p className="sp-sorted-hint">Loading the words…</p>;
  const again = () => { solo.drop(game); setFastest(undefined); setBest(null); setLocal(start()); };
  return (
    <>
      <DuelFrame duel={view} uid={uid} participants={participants} solo
        onMove={async (play: DuelPlay) => { local.move(uid, play); }} onSteer={input => local.steer(uid, input)} />
      {over && best && <p className="sp-solo-record">{best}</p>}
      <div className="sp-sorted-controls">
        <button type="button" className="sp-planning-secondary" onClick={() => { if (over) solo.drop(game); onBack(); }}>{over ? 'Done' : 'Pause'}</button>
        {!over && <button type="button" className="sp-planning-secondary" onClick={() => local.resign(uid)}>Resign</button>}
        {over && <button type="button" className="sp-planning-primary" onClick={again}>Play again</button>}
      </div>
    </>
  );
}

// A duel game: how to play it (the computer, or someone at the table), the
// challenge, your duel once there is one (whichever game it is), and
// others' duels to watch.
export default function GamePage({ game, uid, coins, participants, duels, duel, steer, solo }: GamePageProps) {
  const [mode, setMode] = useState<'pick' | 'solo' | 'challenge'>(() => solo.get(game) ? 'solo' : 'pick');
  const [opponent, setOpponent] = useState<string | null>(null);
  const [stake, setStake] = useState(0);
  const [watching, setWatching] = useState<string | null>(null);
  // After a duel ends, its result stays up until you move on.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<TypingKind>(savedKind);
  const options: DuelOptions | undefined = game === 'typing' ? { text: kind } : undefined;
  const kindPicker = game === 'typing' && <KindPicker kind={kind} onPick={setKind} />;

  const run = async (move: DuelMove) => {
    setBusy(true); setError(null);
    try { await duel(move); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't reach the game. Try again."); return false; }
    finally { setBusy(false); }
  };

  const mine = ownDuel(duels, uid);
  const watched = duels.find(d => d.id === watching && !(uid && (d.challenger.uid === uid || d.opponent.uid === uid)));
  const others = duels.filter(d => d.status === 'playing' && d.challenger.uid !== uid && d.opponent.uid !== uid);
  const errorLine = error && <p role="alert" className="sp-arcade-error">{error}</p>;
  const info = DUEL_GAMES[game];
  const heading = (shown: DuelGame, extra?: string) => (
    <div className="sp-sorted-heading">
      <h3>{DUEL_GAMES[shown].name}{extra && <small className="sp-game-mode">{extra}</small>}</h3>
      <p className="sp-sorted-hint">{DUEL_GAMES[shown].rules}</p>
    </div>
  );

  if (mine && (isLive(mine) || (mine.game === game && dismissed !== mine.id))) {
    const id = mine.id;
    // Moves in games played both at once come thick and fast, and some are
    // refused as part of play ("Not quite"): the board says so itself.
    const move = async (play: DuelPlay) => {
      try { await duel({ operation: 'move', id, ...play }); }
      catch (e) { if (!DUEL_GAMES[mine.game].live) setError(e instanceof Error ? e.message : String(e)); throw e; }
    };
    return (
      <div className="sp-sorted" data-game-page={mine.game}>
        {heading(mine.game)}
        <DuelFrame duel={mine} uid={uid} participants={participants} busy={busy} onMove={move} onSteer={input => steer(id, input)} />
        <div className="sp-sorted-controls">
          {mine.status === 'offered' && mine.challenger.uid === uid && (
            <button type="button" className="sp-planning-secondary" disabled={busy} onClick={() => void run({ operation: 'cancel', id })}>Withdraw challenge</button>
          )}
          {mine.status === 'offered' && mine.opponent.uid === uid && <>
            <button type="button" className="sp-planning-secondary" disabled={busy} onClick={() => void run({ operation: 'decline', id })}>Decline</button>
            <button type="button" className="sp-planning-primary" disabled={busy || coins < mine.stake} onClick={() => void run({ operation: 'accept', id })}>
              {coins < mine.stake ? `You need 🪙 ${mine.stake}` : 'Accept'}
            </button>
          </>}
          {mine.status === 'playing' && (
            <button type="button" className="sp-planning-secondary" disabled={busy} onClick={() => void run({ operation: 'resign', id })}>Resign</button>
          )}
          {!isLive(mine) && <>
            <button type="button" className="sp-planning-secondary" onClick={() => { setDismissed(id); setMode('pick'); setError(null); }}>Done</button>
            <button type="button" className="sp-planning-primary" onClick={() => { setDismissed(id); setMode('challenge'); setError(null); }}>New challenge</button>
          </>}
        </div>
        {errorLine}
      </div>
    );
  }

  if (watched) {
    return (
      <div className="sp-sorted" data-game-page={watched.game}>
        {heading(watched.game, 'Watching')}
        <DuelFrame duel={watched} uid={uid} participants={participants} />
        <div className="sp-sorted-controls">
          <button type="button" className="sp-planning-secondary" onClick={() => setWatching(null)}>Back</button>
        </div>
      </div>
    );
  }

  if (mode === 'solo' && uid) {
    return (
      <div className="sp-sorted" data-game-page={game}>
        {heading(game, 'Practice')}
        <SoloGame game={game} uid={uid} participants={participants} solo={solo} options={options} onBack={() => setMode('pick')} />
      </div>
    );
  }

  const people = Object.entries(participants).filter(([id]) => id !== uid).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  const free = people.filter(([id]) => !isBusy(duels, id));
  const watch = others.length > 0 && (
    <div className="sp-duel-watch">
      <h4>At the table now</h4>
      <ul>
        {others.map(d => (
          <li key={d.id}>
            <span>{d.challenger.name} v {d.opponent.name} <small>{DUEL_GAMES[d.game].name}</small></span>
            <button type="button" className="sp-planning-secondary" onClick={() => setWatching(d.id)}>Watch</button>
          </li>
        ))}
      </ul>
    </div>
  );

  if (mode === 'pick') {
    const soloRecord = describe(game, readRecords()[game]);
    const paused = solo.get(game);
    return (
      <div className="sp-sorted" data-game-page={game}>
        {heading(game)}
        {!(paused && !paused.over) && kindPicker}
        <div className="sp-game-modes">
          <button type="button" className="sp-game-mode-card" data-mode="solo" onClick={() => setMode('solo')}>
            <span className="sp-game-mode-icon" aria-hidden="true">🤖</span>
            <strong>{paused && !paused.over ? 'Carry on practising' : 'Practise against the computer'}</strong>
            <small>{paused && !paused.over ? 'Your game is waiting where you left it.' : soloRecord ?? (info.live ? 'No coins, just your best.' : 'It thinks for a moment each move. No coins, just bragging rights.')}</small>
          </button>
          <button type="button" className="sp-game-mode-card" data-mode="duel" onClick={() => setMode('challenge')}>
            <span className="sp-game-mode-icon" aria-hidden="true">⚔️</span>
            <strong>Challenge someone</strong>
            <small>
              {free.length > 0 && (
                <span className="sp-arcade-faces">
                  {free.slice(0, 4).map(([id, person]) => <img key={id} src={participantAvatarSrc(person)} alt="" width={22} height={22} />)}
                </span>
              )}
              {free.length === 0 ? (people.length ? 'Everyone else is in a duel' : 'Nobody else is at the table yet') : `${whoIsFree(free.map(([, person]) => person.name))}. The winner earns coins`}
            </small>
          </button>
        </div>
        {watch}
      </div>
    );
  }

  const chosen = opponent && participants[opponent] && !isBusy(duels, opponent) ? opponent : null;
  const maxStake = Math.max(0, coins);
  const stakeShown = Math.min(stake, maxStake);
  const send = async () => {
    if (!chosen) return;
    if (await run({ operation: 'challenge', game, opponent: chosen, stake: stakeShown, ...(options ? { options } : {}) })) { setOpponent(null); setDismissed(null); }
  };

  return (
    <div className="sp-sorted" data-game-page={game}>
      {heading(game)}
      {kindPicker}
      <fieldset className="sp-duel-people">
        <legend>Challenge someone at the table</legend>
        {people.length === 0 && <p className="sp-sorted-hint">Nobody else is at the table yet.</p>}
        {people.map(([id, person]) => {
          const taken = isBusy(duels, id);
          return (
            <label key={id} className="sp-duel-person" data-disabled={taken || undefined}>
              <input type="radio" name="sp-duel-opponent" value={id} checked={chosen === id} disabled={taken} onChange={() => setOpponent(id)} />
              <img src={participantAvatarSrc(person)} alt="" width={28} height={28} />
              <span>{person.name}</span>
              {taken && <small>In a duel</small>}
            </label>
          );
        })}
      </fieldset>
      {/* Coins stay out of sight until there are some, as everywhere else. */}
      {maxStake > 0 && (
        <div className="sp-duel-stake-picker">
          <span id="sp-duel-stake-label">Stake</span>
          <button type="button" className="sp-planning-secondary" aria-label="Lower the stake" disabled={stakeShown === 0} onClick={() => setStake(Math.max(0, stakeShown - STAKE_STEP))}>−</button>
          <output aria-labelledby="sp-duel-stake-label">🪙 {stakeShown}</output>
          <button type="button" className="sp-planning-secondary" aria-label="Raise the stake" disabled={stakeShown >= maxStake} onClick={() => setStake(Math.min(maxStake, stakeShown + STAKE_STEP))}>+</button>
          <small>Up to your {maxStake}. They need as many to accept; the winner takes both.</small>
        </div>
      )}
      <div className="sp-sorted-controls">
        <button type="button" className="sp-planning-secondary" onClick={() => { setMode('pick'); setError(null); }}>Back</button>
        <button type="button" className="sp-planning-primary" disabled={busy || !chosen} onClick={() => void send()}>Send challenge</button>
      </div>
      {errorLine}
      {watch}
    </div>
  );
}
