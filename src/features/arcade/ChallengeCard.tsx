import { useEffect, useState } from 'react';
import useMediaQuery from '../../shared/hooks/useMediaQuery.ts';
import { OFFER_MS, formatSeconds, useCountdown } from './duels.ts';
import { duelTitle } from './catalogue.ts';
import type { DuelView } from '../../types/games.ts';
import './arcade.css';

interface ChallengeCardProps {
  // The challenge waiting for an answer, or null for no card.
  duel: DuelView | null;
  coins: number;
  // Accepting resolves once the service has started the game.
  onAnswer: (accept: boolean) => Promise<void>;
  // Distance from the viewport top, below the header (and any achievement card).
  top: number;
}

// On a phone the card covers the table, so after a moment it folds into a
// pill in the same corner, out of the way of the votes; a tap opens it again.
const FOLD_MS = 4000;

// A challenge to you, in the corner where achievements show: who, what's
// at stake, and a bar running down the minute it stays open.
export default function ChallengeCard({ duel, coins, onAnswer, top }: ChallengeCardProps) {
  const left = useCountdown(duel?.offerLeftMs, duel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const narrow = useMediaQuery('(max-width: 640px)');
  // Folded, per challenge: each new one arrives open.
  const [folded, setFolded] = useState<string | null>(null);
  const id = duel?.id;
  useEffect(() => {
    if (!narrow || !id) return;
    const timer = setTimeout(() => setFolded(id), FOLD_MS);
    return () => clearTimeout(timer);
  }, [narrow, id]);
  if (!duel) return null;
  const timer = left !== undefined && (
    <div className="sp-challenge-timer" role="timer" aria-label={`${formatSeconds(left)} left to answer`}>
      <span style={{ width: `${(left / OFFER_MS) * 100}%` }} />
    </div>
  );
  if (narrow && folded === duel.id) {
    return (
      <section key={`${duel.id}-folded`} className="sp-challenge-card" data-folded="true" style={{ top }} aria-label="Duel challenge">
        <button type="button" className="sp-challenge-pill" aria-expanded="false" onClick={() => setFolded(null)}>
          <span aria-hidden="true">⚔️</span> {duel.challenger.name} challenges you
        </button>
        {timer}
      </section>
    );
  }
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
          <span>{duelTitle(duel.game, duel.options)}{duel.stake > 0 ? ` · 🪙 ${duel.stake} each, winner takes both` : ''}</span>
        </span>
      </div>
      <div className="sp-challenge-actions">
        {narrow && <button type="button" className="sp-challenge-later" onClick={() => setFolded(duel.id)}>Later</button>}
        <button type="button" className="sp-planning-secondary" disabled={busy} onClick={() => void answer(false)}>Decline</button>
        <button type="button" className="sp-planning-primary" disabled={busy || short} onClick={() => void answer(true)}>
          {short ? `You need 🪙 ${duel.stake}` : 'Accept'}
        </button>
      </div>
      {error && <p role="alert" className="sp-arcade-error">{error}</p>}
      {timer}
    </section>
  );
}
