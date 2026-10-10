import { useState } from 'react';
import { OFFER_MS, formatSeconds, useCountdown } from './duels.ts';
import type { DuelView } from '../../types/games.ts';
import './toolbox.css';

interface ChallengeCardProps {
  // The challenge waiting for an answer, or null for no card.
  duel: DuelView | null;
  coins: number;
  // Accepting resolves once the service has started the game.
  onAnswer: (accept: boolean) => Promise<void>;
  // Distance from the viewport top, below the header (and any achievement card).
  top: number;
}

// A challenge to you, in the corner where achievements show: who, what's
// at stake, and a bar running down the minute it stays open.
export default function ChallengeCard({ duel, coins, onAnswer, top }: ChallengeCardProps) {
  const left = useCountdown(duel?.offerLeftMs, duel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!duel) return null;
  const short = coins < duel.stake;
  const answer = async (accept: boolean) => {
    setBusy(true); setError(null);
    try { await onAnswer(accept); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't reach the game. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <section key={duel.id} className="sp-challenge-card" style={{ top }} aria-label="Duel challenge" aria-live="polite">
      <div className="sp-challenge-body">
        <span className="sp-challenge-icon" aria-hidden="true">⚔️</span>
        <span className="sp-challenge-text">
          <small>Duel challenge</small>
          <strong>{duel.challenger.name} challenges you</strong>
          <span>Noughts and crosses{duel.stake > 0 ? ` · 🪙 ${duel.stake} each, winner takes both` : ''}</span>
        </span>
      </div>
      <div className="sp-challenge-actions">
        <button type="button" className="sp-planning-secondary" disabled={busy} onClick={() => void answer(false)}>Decline</button>
        <button type="button" className="sp-planning-primary" disabled={busy || short} onClick={() => void answer(true)}>
          {short ? `You need 🪙 ${duel.stake}` : 'Accept'}
        </button>
      </div>
      {error && <p role="alert" className="sp-toolbox-error">{error}</p>}
      {left !== undefined && (
        <div className="sp-challenge-timer" role="timer" aria-label={`${formatSeconds(left)} left to answer`}>
          <span style={{ width: `${(left / OFFER_MS) * 100}%` }} />
        </div>
      )}
    </section>
  );
}
