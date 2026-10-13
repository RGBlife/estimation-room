import { useEffect, useState } from 'react';
import { achievementById } from './catalogue.ts';
import { useStableCallback } from '../../shared/hooks/useStableCallback.ts';
import './achievements.css';

// How long each unlock stays up, and its exit. The entrance (slide, then the
// card flipping face up) is timed in achievements.css.
const SHOW_MS = 4200;
const EXIT_MS = 300;

interface AchievementToastProps {
  // Unlocked achievement ids waiting to be shown, oldest first.
  queue: string[];
  // The first in the queue has been shown.
  onShown: () => void;
  onOpen: () => void;
  // Distance from the viewport top, measured by the caller to clear the header.
  top: number;
}

// One unlock at a time in the top-right corner, below the header: a small
// card slides in and flips face up, the way votes do on reveal. Secret
// achievements flip over from the hatched back the drawer shows them with.
export default function AchievementToast({ queue, onShown, onOpen, top }: AchievementToastProps) {
  const id = queue[0];
  const achievement = id === undefined ? undefined : achievementById(id);
  const [closing, setClosing] = useState(false);
  // Timers run per unlock, not per render of the caller.
  const shown = useStableCallback(onShown);

  useEffect(() => {
    if (id === undefined) return;
    // An id this page doesn't know is dropped at once.
    if (!achievement) { shown(); return; }
    setClosing(false);
    const exit = setTimeout(() => setClosing(true), SHOW_MS);
    const done = setTimeout(shown, SHOW_MS + EXIT_MS);
    return () => { clearTimeout(exit); clearTimeout(done); };
  }, [id, achievement, shown]);

  if (!achievement) return null;
  const isSecret = achievement.clue !== undefined;
  return (
    <div role="status" className="sp-achievement-toast" data-closing={closing} style={{ top }}>
      <button key={achievement.id} type="button" onClick={() => { onOpen(); onShown(); }} aria-label={`${isSecret ? 'Secret achievement' : 'Achievement'} unlocked: ${achievement.name}. Show all achievements`}>
        <span className="sp-achievement-flip" data-secret={isSecret} aria-hidden="true">
          <span className="sp-achievement-back" />
          <span className="sp-achievement-front">{achievement.icon}</span>
        </span>
        <span className="sp-achievement-toast-text">
          <small>{isSecret ? 'Secret achievement unlocked' : 'Achievement unlocked'}</small>
          <strong>{achievement.name}</strong>
          <span>{achievement.how}</span>
        </span>
      </button>
    </div>
  );
}
