import { useEffect, useState } from 'react';
import AchievementToast from './AchievementToast.tsx';
import AchievementsWindow from './AchievementsWindow.tsx';
import { ACHIEVEMENTS, unlockedCount } from './catalogue.ts';
import type { PlayerProfile } from '../../types/player.ts';

interface Options {
  // Null where the room service keeps no progress: then nothing shows.
  profile: PlayerProfile | null;
  unlocked: string[];
  onShown: () => void;
  onReset: () => Promise<void>;
  // Open the drawer straight away (the dev harness's ?achievements=).
  initialPanel?: 'list' | 'reset';
}

// Everything achievements add to a room: the menu items for the header, and
// the toast and drawer to render. One hook, so the room and the dev harness
// put them together the same way.
export function useAchievements({ profile, unlocked, onShown, onReset, initialPanel }: Options) {
  const [panel, setPanel] = useState<'list' | 'reset' | null>(initialPanel ?? null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!closing) return;
    // Mounted through the exit, as the planning drawers are.
    const timer = setTimeout(() => { setPanel(null); setClosing(false); }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
    return () => clearTimeout(timer);
  }, [closing]);

  const earned = unlockedCount(profile?.achievements);
  const header = profile ? {
    unlocked: earned,
    total: ACHIEVEMENTS.length,
    onOpen: () => setPanel('list'),
    onReset: earned > 0 || profile.coins > 0 ? () => setPanel('reset') : undefined,
  } : undefined;

  const render = (top: number) => profile && (
    <>
      <AchievementToast queue={unlocked} onShown={onShown} onOpen={() => setPanel('list')} top={top} />
      {panel && <AchievementsWindow key={panel} profile={profile} confirmingReset={panel === 'reset'} closing={closing} onClose={() => setClosing(true)} onReset={onReset} />}
    </>
  );
  return { header, render };
}
