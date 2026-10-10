import { useEffect, useState } from 'react';
import ToolboxWindow from './ToolboxWindow.tsx';
import SortedGame from './SortedGame.tsx';
import type { PlayerProfile } from '../../types/player.ts';
import type { SortedMove, SortedView } from '../../types/games.ts';

interface Options {
  // Null where the room service keeps no progress: then there is no Toolbox.
  profile: PlayerProfile | null;
  // Games are for between rounds: open only while the votes are revealed.
  isRevealed: boolean;
  playSorted: (move: SortedMove) => Promise<SortedView>;
  // Open straight away (the dev harness's ?toolbox=open).
  initiallyOpen?: boolean;
}

// The Toolbox's menu item for the header, and the window to render. It
// closes itself when the next round starts; the game in play is kept by
// the service and picks up where it was at the next reveal.
export function useToolbox({ profile, isRevealed, playSorted, initiallyOpen = false }: Options) {
  const [open, setOpen] = useState(initiallyOpen);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => { setOpen(false); setClosing(false); }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
    return () => clearTimeout(timer);
  }, [closing]);
  useEffect(() => { if (!isRevealed && open) setClosing(true); }, [isRevealed, open]);

  const header = profile ? { coins: profile.coins, available: isRevealed, onOpen: () => setOpen(true) } : undefined;
  const render = () => profile && open && (
    <ToolboxWindow coins={profile.coins} closing={closing} onClose={() => setClosing(true)}>
      <SortedGame play={playSorted} />
    </ToolboxWindow>
  );
  return { header, render };
}
