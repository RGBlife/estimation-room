import { useState } from 'react';
import { participantAvatarSrc } from '../avatar/index.js';
import NoughtsBoard from './NoughtsBoard.tsx';
import BattleshipBoard from './BattleshipBoard.tsx';
import { DUEL_GAMES, OFFER_MS, TURN_MS, duelSummary, formatSeconds, isBusy, isLive, ownDuel, shotSummary, useCountdown } from './duels.ts';
import type { Participant } from '../../types/room.ts';
import type { DuelGame as Game, DuelMove, DuelSide, DuelView } from '../../types/games.ts';

const STAKE_STEP = 5;

interface DuelGameProps {
  game: Game;
  uid: string | null;
  coins: number;
  participants: Record<string, Participant>;
  duels: DuelView[];
  duel: (move: DuelMove) => Promise<void>;
}

// A player at the board: their face, name and mark, glowing on their turn.
function Player({ duel, side, uid, participants }: { duel: DuelView; side: DuelSide; uid: string | null; participants: Record<string, Participant> }) {
  const person = participants[side.uid];
  return (
    <span className="sp-duel-player" data-turn={duel.status === 'playing' && !duel.paused && duel.turn === side.uid}>
      {person ? <img src={participantAvatarSrc(person)} alt="" width={30} height={30} /> : <span className="sp-duel-player-gone" aria-hidden="true" />}
      <span>{side.uid === uid ? 'You' : side.name}</span>
      {side.mark && <b data-mark={side.mark} aria-label={`plays ${side.mark}`}>{side.mark}</b>}
    </span>
  );
}

// A duel as either player or anyone watching sees it. Squares are playable
// only on your own turn; the service checks every move again.
function DuelBoard({ duel, uid, participants, busy, onMove }: { duel: DuelView; uid: string | null; participants: Record<string, Participant>; busy: boolean; onMove?: (cell: number) => void }) {
  const left = useCountdown(duel.status === 'offered' ? duel.offerLeftMs : duel.turnLeftMs, duel);
  const summary = duelSummary(duel, uid);
  const playable = !!onMove && !busy && duel.status === 'playing' && !duel.paused && duel.turn === uid;
  const paid = uid ? duel.paid?.[uid] : undefined;
  const move = (cell: number) => onMove?.(cell);
  const shot = duel.game === 'battleship' && duel.status === 'playing' ? shotSummary(duel, uid) : null;
  return (
    <div className="sp-duel">
      <div className="sp-duel-players">
        <Player duel={duel} side={duel.challenger} uid={uid} participants={participants} />
        {duel.stake > 0
          ? <span className="sp-duel-stake" aria-label={`${duel.stake} coins each at stake`}><span aria-hidden="true" className="sp-duel-coins" />{duel.stake * 2}</span>
          : <span className="sp-duel-v">v</span>}
        <Player duel={duel} side={duel.opponent} uid={uid} participants={participants} />
      </div>
      {/* The clock for the answer or the move, running down under the players. */}
      {left !== undefined && isLive(duel) && (
        <div className="sp-duel-timer" aria-hidden="true" data-low={left < 10_000}>
          <span style={{ width: `${(left / (duel.status === 'offered' ? OFFER_MS : TURN_MS)) * 100}%` }} />
        </div>
      )}
      {duel.game === 'noughts'
        ? <NoughtsBoard duel={duel} playable={playable} onMove={move} />
        : <BattleshipBoard duel={duel} uid={uid} playable={playable} onMove={move} />}
      <p role="status" className="sp-duel-status" data-outcome={summary.outcome}>
        {shot && <span className="sp-duel-shot">{shot}</span>}
        <strong>{summary.text}</strong>
        {left !== undefined && isLive(duel) && <span className="sp-duel-clock" data-low={left < 10_000}>{formatSeconds(left)}</span>}
        {paid !== undefined && paid > 0 && <span>+{paid} coins</span>}
      </p>
    </div>
  );
}

// A duel game against someone at the table: the challenge form, your duel
// once there is one (whichever game it is), and others' duels to watch.
export default function DuelGame({ game, uid, coins, participants, duels, duel }: DuelGameProps) {
  const [opponent, setOpponent] = useState<string | null>(null);
  const [stake, setStake] = useState(0);
  const [watching, setWatching] = useState<string | null>(null);
  // After a duel ends, its result stays up until a new challenge is wanted.
  const [challenging, setChallenging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const heading = (shown: Game) => (
    <div className="sp-sorted-heading">
      <h3>{DUEL_GAMES[shown].name}</h3>
      <p className="sp-sorted-hint">{DUEL_GAMES[shown].rules}</p>
    </div>
  );

  if (mine && (isLive(mine) || !challenging)) {
    const id = mine.id;
    return (
      <div className="sp-sorted">
        {heading(mine.game)}
        <DuelBoard duel={mine} uid={uid} participants={participants} busy={busy} onMove={cell => void run({ operation: 'move', id, cell })} />
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
          {!isLive(mine) && (
            <button type="button" className="sp-planning-primary" onClick={() => { setChallenging(true); setError(null); }}>New challenge</button>
          )}
        </div>
        {errorLine}
      </div>
    );
  }

  if (watched) {
    return (
      <div className="sp-sorted">
        {heading(watched.game)}
        <DuelBoard duel={watched} uid={uid} participants={participants} busy />
        <div className="sp-sorted-controls">
          <button type="button" className="sp-planning-secondary" onClick={() => setWatching(null)}>Back</button>
        </div>
      </div>
    );
  }

  const people = Object.entries(participants).filter(([id]) => id !== uid).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  const chosen = opponent && participants[opponent] && !isBusy(duels, opponent) ? opponent : null;
  const maxStake = Math.max(0, coins);
  const stakeShown = Math.min(stake, maxStake);
  const send = async () => {
    if (!chosen) return;
    if (await run({ operation: 'challenge', game, opponent: chosen, stake: stakeShown })) { setChallenging(false); setOpponent(null); }
  };

  return (
    <div className="sp-sorted">
      {heading(game)}
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
        <button type="button" className="sp-planning-primary" disabled={busy || !chosen} onClick={() => void send()}>Send challenge</button>
      </div>
      {errorLine}
      {others.length > 0 && (
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
      )}
    </div>
  );
}
