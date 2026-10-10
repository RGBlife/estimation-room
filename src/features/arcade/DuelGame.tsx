import { useState } from 'react';
import { participantAvatarSrc } from '../avatar/index.js';
import { DUEL_GAMES, duelSummary, formatSeconds, isBusy, isLive, ownDuel, shotSummary, useCountdown } from './duels.ts';
import type { Participant } from '../../types/room.ts';
import type { DuelGame as Game, DuelMove, DuelSea, DuelSide, DuelView } from '../../types/games.ts';

const STAKE_STEP = 5;
// Matches Duels.Sea in the room service.
const SEA = 6;
const ROWS = 'ABCDEF';

interface DuelGameProps {
  game: Game;
  uid: string | null;
  coins: number;
  participants: Record<string, Participant>;
  duels: DuelView[];
  duel: (move: DuelMove) => Promise<void>;
}

function PlayerName({ duel, side, uid }: { duel: DuelView; side: DuelSide; uid: string | null }) {
  return (
    <span className="sp-duel-player" data-turn={duel.status === 'playing' && duel.turn === side.uid}>
      {side.mark && <b data-mark={side.mark} aria-hidden="true">{side.mark}</b>}
      {side.uid === uid ? 'You' : side.name}
    </span>
  );
}

function NoughtsBoard({ duel, playable, onMove }: { duel: DuelView; playable: boolean; onMove: (cell: number) => void }) {
  return (
    <div className="sp-duel-grid" role="group" aria-label="Board">
      {(duel.board ?? []).map((mark, cell) => (
        <button key={cell} type="button" className="sp-duel-cell" data-mark={mark ?? undefined} data-line={duel.line?.includes(cell) || undefined}
          aria-label={`Square ${cell + 1}${mark ? `, ${mark}` : ''}`}
          disabled={!playable || mark !== null} onClick={() => onMove(cell)}>
          {mark}
        </button>
      ))}
    </div>
  );
}

// One side's waters. Firing at them is possible only on the target grid on
// your turn; your own grid shows your ships and where theirs landed.
function Sea({ label, sea, playable, onFire, last }: { label: string; sea: DuelSea; playable: boolean; onFire?: (cell: number) => void; last?: number }) {
  const shots = new Map(sea.shots.map(s => [s.cell, s.hit]));
  const ships = new Set(sea.fleet?.flat());
  const sunk = new Set(sea.sunk.flat());
  return (
    <div className="sp-sea">
      <h4>{label}</h4>
      <div className="sp-sea-grid" role="group" aria-label={label}>
        {Array.from({ length: SEA * SEA }, (_, cell) => {
          const shot = shots.get(cell);
          const state = sunk.has(cell) ? 'sunk' : shot === true ? 'hit' : shot === false ? 'miss' : ships.has(cell) ? 'ship' : 'water';
          const name = `${ROWS[Math.floor(cell / SEA)]}${(cell % SEA) + 1}`;
          return (
            <button key={cell} type="button" className="sp-sea-cell" data-state={state} data-ship={ships.has(cell) || undefined} data-last={cell === last || undefined}
              aria-label={`${name}${state === 'water' ? '' : `, ${state}`}`}
              disabled={!playable || shot !== undefined} onClick={() => onFire?.(cell)}>
              {state === 'miss' ? '•' : state === 'hit' || state === 'sunk' ? '✕' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BattleshipBoard({ duel, uid, playable, onMove }: { duel: DuelView; uid: string | null; playable: boolean; onMove: (cell: number) => void }) {
  if (!duel.seas) return <p className="sp-sorted-hint">The fleets put to sea once the challenge is accepted.</p>;
  const me = duel.challenger.uid === uid ? duel.challenger : duel.opponent.uid === uid ? duel.opponent : null;
  const them = me && (me === duel.challenger ? duel.opponent : duel.challenger);
  const empty: DuelSea = { shots: [], sunk: [] };
  const lastIn = (owner: DuelSide) => duel.lastShot && duel.lastShot.by !== owner.uid ? duel.lastShot.cell : undefined;
  if (me && them) {
    return (
      <div className="sp-seas">
        <Sea label="Their waters" sea={duel.seas[them.uid] ?? empty} playable={playable} onFire={onMove} last={lastIn(them)} />
        <Sea label="Your fleet" sea={duel.seas[me.uid] ?? empty} playable={false} last={lastIn(me)} />
      </div>
    );
  }
  return (
    <div className="sp-seas">
      {[duel.challenger, duel.opponent].map(side => (
        <Sea key={side.uid} label={`${side.name}'s fleet`} sea={duel.seas![side.uid] ?? empty} playable={false} last={lastIn(side)} />
      ))}
    </div>
  );
}

// A duel as either player or anyone watching sees it. Squares are playable
// only on your own turn; the service checks every move again.
function DuelBoard({ duel, uid, busy, onMove }: { duel: DuelView; uid: string | null; busy: boolean; onMove?: (cell: number) => void }) {
  const left = useCountdown(duel.status === 'offered' ? duel.offerLeftMs : duel.turnLeftMs, duel);
  const summary = duelSummary(duel, uid);
  const playable = !!onMove && !busy && duel.status === 'playing' && !duel.paused && duel.turn === uid;
  const paid = uid ? duel.paid?.[uid] : undefined;
  const move = (cell: number) => onMove?.(cell);
  const shot = duel.game === 'battleship' && duel.status === 'playing' ? shotSummary(duel, uid) : null;
  return (
    <div className="sp-duel">
      <p className="sp-duel-players">
        <PlayerName duel={duel} side={duel.challenger} uid={uid} /> <span className="sp-duel-v">v</span> <PlayerName duel={duel} side={duel.opponent} uid={uid} />
        {duel.stake > 0 && <span className="sp-duel-stake" aria-label={`${duel.stake} coins each at stake`}>🪙 {duel.stake} each</span>}
      </p>
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
        <DuelBoard duel={mine} uid={uid} busy={busy} onMove={cell => void run({ operation: 'move', id, cell })} />
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
        <DuelBoard duel={watched} uid={uid} busy />
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
