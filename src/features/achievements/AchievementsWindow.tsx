import { useState } from 'react';
import PlanningWindow from '../planning/PlanningWindow.tsx';
import { ACHIEVEMENTS, unlockedCount } from './catalogue.ts';
import type { PlayerProfile } from '../../types/player.ts';
import './achievements.css';

interface AchievementsWindowProps {
  profile: PlayerProfile;
  closing: boolean;
  onClose: () => void;
  onReset: () => Promise<void>;
  // Opened from "Reset my progress": start with the confirmation showing.
  confirmingReset?: boolean;
}

const dateOf = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// The whole collection as a hand of cards, in catalogue order so each one
// keeps its place: earned ones face up with the day they were earned, the
// rest showing how to earn them, and secrets face down with only a clue.
export default function AchievementsWindow({ profile, closing, onClose, onReset, confirmingReset = false }: AchievementsWindowProps) {
  const [confirming, setConfirming] = useState(confirmingReset);
  const [error, setError] = useState<string | null>(null);
  const earned = unlockedCount(profile.achievements);
  const hasProgress = earned > 0 || profile.coins > 0;

  const reset = async () => {
    setError(null);
    try { await onReset(); setConfirming(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't reset your progress. Try again."); }
  };

  return (
    <PlanningWindow title="Achievements" subtitle={`${earned} of ${ACHIEVEMENTS.length} unlocked`} side="right" closing={closing} onClose={onClose}>
      <div className="sp-achievements-body">
        <ul className="sp-achievement-grid">
          {ACHIEVEMENTS.map(achievement => {
            const at = profile.achievements[achievement.id];
            const state = at !== undefined ? 'earned' : achievement.clue !== undefined ? 'secret' : 'locked';
            return (
              <li key={achievement.id} className="sp-achievement-card" data-state={state}>
                {state === 'secret' ? (
                  <>
                    <span className="sp-achievement-card-mark" aria-hidden="true">?</span>
                    <span className="sp-achievement-card-text">
                      <strong><span className="sr-only">Secret achievement. Clue: </span>???</strong>
                      <em>{achievement.clue}</em>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="sp-achievement-card-mark" aria-hidden="true">{achievement.icon}</span>
                    <span className="sp-achievement-card-text">
                      <strong>{achievement.name}</strong>
                      <span>{achievement.how}</span>
                    </span>
                    {at !== undefined
                      ? <time dateTime={new Date(at).toISOString()}>{dateOf(at)}</time>
                      : <span className="sr-only">Not yet unlocked</span>}
                  </>
                )}
              </li>
            );
          })}
        </ul>

        {hasProgress && (
          <div className="sp-achievements-reset">
            {confirming ? (
              <>
                <p>This deletes the achievements you've earned in this browser. It can't be undone.</p>
                <div className="sp-planning-row">
                  <button type="button" className="sp-achievements-danger" onClick={() => void reset()}>Reset my progress</button>
                  <button type="button" className="sp-planning-secondary" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </>
            ) : (
              <button type="button" className="sp-achievements-reset-link" onClick={() => setConfirming(true)}>Reset my progress</button>
            )}
            {error && <p role="alert" className="sp-achievements-error">{error}</p>}
          </div>
        )}
      </div>
    </PlanningWindow>
  );
}
