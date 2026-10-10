import { useEffect, useState } from 'react';
import ToolboxWindow, { type ToolboxGame } from './ToolboxWindow.tsx';
import SortedGame from './SortedGame.tsx';
import RareFindGame from './RareFindGame.tsx';
import DuelGame from './DuelGame.tsx';
import ChallengeCard from './ChallengeCard.tsx';
import { incomingChallenge, isMyMove, ownDuel } from './duels.ts';
import type { PlayerProfile } from '../../types/player.ts';
import type { Participant } from '../../types/room.ts';
import type { DuelMove, DuelView, RareMove, RareView, SortedMove, SortedView } from '../../types/games.ts';

interface Options {
  // Null where the room service keeps no progress: then there is no Toolbox.
  profile: PlayerProfile | null;
  // Games are for between rounds: open only while the votes are revealed.
  isRevealed: boolean;
  uid: string | null;
  participants: Record<string, Participant>;
  duels: DuelView[];
  playSorted: (move: SortedMove) => Promise<SortedView>;
  playRare: (move: RareMove) => Promise<RareView>;
  duel: (move: DuelMove) => Promise<void>;
  // Open straight away (the dev harness's ?toolbox=open, or =noughts).
  initiallyOpen?: boolean;
  initialGame?: ToolboxGame;
}

// The Toolbox's menu item for the header, the window, and the card for a
// challenge to you. The window closes itself when the next round starts;
// games in play are kept by the service and pick up at the next reveal.
export function useToolbox({ profile, isRevealed, uid, participants, duels, playSorted, playRare, duel, initiallyOpen = false, initialGame = 'sorted' }: Options) {
  const [open, setOpen] = useState(initiallyOpen);
  const [game, setGame] = useState<ToolboxGame>(initialGame);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => { setOpen(false); setClosing(false); }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
    return () => clearTimeout(timer);
  }, [closing]);
  useEffect(() => { if (!isRevealed && open) setClosing(true); }, [isRevealed, open]);

  const incoming = incomingChallenge(duels, uid);
  const mine = ownDuel(duels, uid);
  const yourMove = isMyMove(mine, uid);
  // The duel game with something waiting for you.
  const waiting = incoming?.game ?? (yourMove ? mine!.game : undefined);
  const header = profile ? {
    coins: profile.coins,
    available: isRevealed,
    alert: incoming ? 'Challenge' : yourMove ? 'Your move' : undefined,
    onOpen: () => { if (waiting) setGame(waiting); setOpen(true); },
  } : undefined;

  const answer = async (accept: boolean) => {
    if (!incoming) return;
    await duel({ operation: accept ? 'accept' : 'decline', id: incoming.id });
    if (accept) { setGame(incoming.game); setOpen(true); }
  };

  // `top`: where the challenge card sits, below the header.
  const render = (top: number) => profile && (
    <>
      {/* Inside the window the challenge shows on the Noughts and crosses page instead. */}
      {!open && <ChallengeCard duel={incoming} coins={profile.coins} onAnswer={answer} top={top} />}
      {open && (
        <ToolboxWindow coins={profile.coins} game={game} onSelectGame={setGame} waiting={waiting ? [waiting] : []}
          closing={closing} onClose={() => setClosing(true)}>
          {game === 'sorted' && <SortedGame play={playSorted} />}
          {game === 'rare' && <RareFindGame play={playRare} />}
          {(game === 'noughts' || game === 'battleship') && (
            <DuelGame key={game} game={game} uid={uid} coins={profile.coins} participants={participants} duels={duels} duel={duel} />
          )}
        </ToolboxWindow>
      )}
    </>
  );
  return { header, render };
}
