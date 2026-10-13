import { participantAvatarSrc } from '../avatar/index.js';
import { BOARDS } from './boards/index.ts';
import { DUEL_GAMES } from './catalogue.ts';
import { OFFER_MS, TURN_MS, duelSummary, formatSeconds, isLive, shotSummary, useCountdown } from './duels.ts';
import { useLiveDuel } from './frames.ts';
import { COMPUTER } from './play/local.ts';
import type { Participant } from '../../types/room.ts';
import type { DuelPlay, DuelSide, DuelSteer, DuelView } from '../../types/games.ts';
import './boards/boards.css';

// A player at the board: their face, name and mark, glowing on their turn.
// The computer has a face of its own.
function Player({ duel, side, uid, participants }: { duel: DuelView; side: DuelSide; uid: string | null; participants: Record<string, Participant> }) {
  const person = participants[side.uid];
  return (
    <span className="sp-duel-player" data-turn={duel.status === 'playing' && !duel.paused && duel.turn === side.uid}>
      {side.uid === COMPUTER.uid ? <span className="sp-duel-player-bot" aria-hidden="true">🤖</span>
        : person ? <img src={participantAvatarSrc(person)} alt="" width={30} height={30} /> : <span className="sp-duel-player-gone" aria-hidden="true" />}
      <span>{side.uid === uid ? 'You' : side.name}</span>
      {side.mark && <b data-mark={side.mark} aria-label={`plays ${side.mark}`}>{side.mark}</b>}
    </span>
  );
}

interface DuelFrameProps {
  // The duel's last full state; frames since are merged in here.
  duel: DuelView;
  uid: string | null;
  participants: Record<string, Participant>;
  // Missing for someone watching.
  onMove?: (play: DuelPlay) => Promise<void>;
  onSteer?: (input: DuelSteer) => void;
  // Against the computer: no stake and no turn clock.
  solo?: boolean;
  busy?: boolean;
}

// Any duel game, for whoever's looking: the two players, the stake between
// them, the clock, the board, and a line on where it stands.
export default function DuelFrame({ duel, uid, participants, onMove, onSteer, solo = false, busy = false }: DuelFrameProps) {
  const live = useLiveDuel(duel);
  const turnLeft = useCountdown(duel.status === 'offered' ? duel.offerLeftMs : solo ? undefined : duel.turnLeftMs, duel);
  const startsIn = useCountdown(duel.paused ? undefined : duel.startsInMs, duel);
  const endsIn = useCountdown(duel.paused ? undefined : duel.endsInMs, duel);
  const player = !!onMove && (duel.challenger.uid === uid || duel.opponent.uid === uid);
  const playing = duel.status === 'playing' && !duel.paused;
  const playable = player && !busy && playing && (!duel.turn || duel.turn === uid);
  const summary = duelSummary(duel, uid);
  const paid = uid ? duel.paid?.[uid] : undefined;
  const shot = duel.game === 'battleship' && duel.status === 'playing' ? shotSummary(duel, uid) : null;
  const Board = BOARDS[duel.game];
  // In the games played both at once, the board says how it's going.
  const quiet = DUEL_GAMES[duel.game].live && duel.status === 'playing' && !duel.paused;
  return (
    <div className="sp-duel" data-game={duel.game}>
      <div className="sp-duel-players">
        <Player duel={duel} side={duel.challenger} uid={uid} participants={participants} />
        {duel.stake > 0
          ? <span className="sp-duel-stake" aria-label={`${duel.stake} coins each at stake`}><span aria-hidden="true" className="sp-duel-coins" />{duel.stake * 2}</span>
          : <span className="sp-duel-v">v</span>}
        <Player duel={duel} side={duel.opponent} uid={uid} participants={participants} />
      </div>
      {/* The clock for the answer or the move, running down under the players. */}
      {turnLeft !== undefined && isLive(duel) && (
        <div className="sp-duel-timer" aria-hidden="true" data-low={turnLeft < 10_000}>
          <span style={{ width: `${(turnLeft / (duel.status === 'offered' ? OFFER_MS : TURN_MS)) * 100}%` }} />
        </div>
      )}
      {duel.status !== 'offered' && (
        // A new game is a new board: nothing typed, traced or chosen carries over.
        <Board key={duel.id} duel={live} uid={uid} player={player} playable={playable}
          onMove={onMove ?? (async () => {})} onSteer={onSteer ?? (() => {})} clock={{ startsIn, endsIn }} />
      )}
      <p role="status" className="sp-duel-status" data-outcome={summary.outcome}>
        {shot && <span className="sp-duel-shot">{shot}</span>}
        {!quiet && <strong>{summary.text}</strong>}
        {turnLeft !== undefined && isLive(duel) && <span className="sp-duel-clock" data-low={turnLeft < 10_000}>{formatSeconds(turnLeft)}</span>}
        {paid !== undefined && paid > 0 && <span>+{paid} coins</span>}
      </p>
    </div>
  );
}
