import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import ArcadeWindow from './ArcadeWindow.tsx';
import { isDuelGame, type ArcadeGame } from './catalogue.ts';
import type { SoloGames } from './GamePage.tsx';
import type { LocalDuel } from './play/local.ts';
import ChallengeCard from './ChallengeCard.tsx';
import ArcadeHome from './ArcadeHome.tsx';
import { incomingChallenge, isMyMove, ownDuel } from './duels.ts';
import type { PlayerProfile } from '../../types/player.ts';
import type { Participant } from '../../types/room.ts';
import type { DuelGame, DuelMove, DuelSteer, DuelView, RareMove, RareView, SortedMove, SortedView } from '../../types/games.ts';

// Each game is its own chunk, fetched when first opened, so a room never
// downloads games nobody plays.
const SortedGame = lazy(() => import('./SortedGame.tsx'));
const RareFindGame = lazy(() => import('./RareFindGame.tsx'));
const GamePage = lazy(() => import('./GamePage.tsx'));


interface Options {
  // Null where the room service keeps no progress: then there is no Arcade.
  profile: PlayerProfile | null;
  // Games are for between rounds: open only while the votes are revealed.
  isRevealed: boolean;
  uid: string | null;
  participants: Record<string, Participant>;
  duels: DuelView[];
  playSorted: (move: SortedMove) => Promise<SortedView>;
  playRare: (move: RareMove) => Promise<RareView>;
  duel: (move: DuelMove) => Promise<void>;
  steer: (id: string, input: DuelSteer) => void;
  // Open straight away (the dev harness's ?arcade=open, or a game).
  initiallyOpen?: boolean;
  initialGame?: ArcadeGame | null;
}

// The Arcade's menu item for the header, the window, and the card for a
// challenge to you. The window closes itself when the next round starts;
// games in play are kept by the service and pick up at the next reveal.
export function useArcade({ profile, isRevealed, uid, participants, duels, playSorted, playRare, duel, steer, initiallyOpen = false, initialGame = null }: Options) {
  const [open, setOpen] = useState(initiallyOpen);
  // The game open, or null for the Arcade's home.
  const [game, setGame] = useState<ArcadeGame | null>(initialGame);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => { setOpen(false); setClosing(false); }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
    return () => clearTimeout(timer);
  }, [closing]);
  useEffect(() => { if (!isRevealed && open) setClosing(true); }, [isRevealed, open]);

  // Games against the computer, kept while you're at the table: closing the
  // window pauses one, it doesn't end it.
  const solos = useRef(new Map<DuelGame, LocalDuel>());
  const solo: SoloGames = useMemo(() => ({
    get: game => solos.current.get(game),
    keep: (game, local) => { solos.current.set(game, local); },
    drop: game => { solos.current.delete(game); },
  }), []);

  const incoming = incomingChallenge(duels, uid);
  const mine = ownDuel(duels, uid);
  const yourMove = isMyMove(mine, uid);
  const header = profile ? {
    coins: profile.coins,
    available: isRevealed,
    alert: incoming ? 'Challenge' : yourMove ? 'Your move' : undefined,
    // Straight to a duel that's waiting on you; otherwise the home.
    onOpen: () => { setGame(yourMove ? mine!.game : null); setOpen(true); },
  } : undefined;

  const answer = async (accept: boolean) => {
    if (!incoming) return;
    await duel({ operation: accept ? 'accept' : 'decline', id: incoming.id });
    if (accept) { setGame(incoming.game); setOpen(true); }
  };

  // `top`: where the challenge card sits, below the header.
  const render = (top: number) => profile && (
    <>
      {/* Inside the window the challenge shows on the Arcade's home instead. */}
      {!open && <ChallengeCard duel={incoming} coins={profile.coins} onAnswer={answer} top={top} />}
      {open && (
        <ArcadeWindow coins={profile.coins} game={game} onHome={() => setGame(null)} closing={closing} onClose={() => setClosing(true)}>
          {game === null && <ArcadeHome profile={profile} uid={uid} participants={participants} duels={duels} incoming={incoming} mine={mine} onOpen={setGame} onAnswer={answer} />}
          <Suspense fallback={<p className="sp-sorted-hint">Loading the game…</p>}>
            {game === 'sorted' && <SortedGame play={playSorted} />}
            {game === 'rare' && <RareFindGame play={playRare} />}
            {isDuelGame(game) && <GamePage key={game} game={game} uid={uid} coins={profile.coins} participants={participants} duels={duels} duel={duel} steer={steer} solo={solo} />}
          </Suspense>
        </ArcadeWindow>
      )}
    </>
  );
  return { header, render };
}
