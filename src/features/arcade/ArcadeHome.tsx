import { useState } from 'react';
import { DUEL_GAMES, isLive, isMyMove } from './duels.ts';
import type { ArcadeGame } from './ArcadeWindow.tsx';
import type { PlayerProfile } from '../../types/player.ts';
import type { DuelView } from '../../types/games.ts';

interface ArcadeHomeProps {
  profile: PlayerProfile;
  uid: string | null;
  duels: DuelView[];
  // A challenge waiting for your answer, and the duel you're in, if any.
  incoming: DuelView | null;
  mine: DuelView | null;
  onOpen: (game: ArcadeGame) => void;
  onAnswer: (accept: boolean) => Promise<void>;
}

// Each game's cover: drawn, not pictured, from the game's own pieces.
function Art({ game }: { game: ArcadeGame }) {
  switch (game) {
    case 'sorted':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          {[0, 1, 2, 3].map(level => <rect key={level} x="22" y={10 + level * 18} width="116" height="14" rx="4" fill={`var(--sp-level-${level})`} />)}
        </svg>
      );
    case 'rare':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          {[64, 50, 37, 22, 9].map((h, i) => <rect key={i} x={30 + i * 22} y={80 - h} width="14" height={h} rx="3" fill="currentColor" opacity={i === 4 ? 1 : 0.35} />)}
          <path d="M28 80h106" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5" />
        </svg>
      );
    case 'noughts':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3.4">
          <path d="M66 14c-1 22 1 44 0 64M94 13c1 22-1 44 1 65M45 37c24-2 47 1 70-1M46 60c23 2 46-1 69 1" opacity=".35" strokeWidth="2.6" />
          <path d="M51 19l10 12M61 19l-10 12" className="sp-art-x" />
          <circle cx="80" cy="48" r="7" />
          <path d="M101 66l10 12M111 66l-10 12" className="sp-art-x" />
        </svg>
      );
    case 'battleship':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true" fill="none">
          {[16, 30, 44].map(r => <circle key={r} cx="112" cy="45" r={r} stroke="var(--sp-sea-foam)" strokeOpacity=".35" />)}
          <rect x="34" y="40" width="62" height="12" rx="6" fill="var(--sp-sea-hull)" />
          <circle cx="112" cy="45" r="4" fill="var(--sp-sea-hit)" />
        </svg>
      );
  }
}

const GAMES: { id: ArcadeGame; name: string }[] = [
  { id: 'sorted', name: 'Sorted' },
  { id: 'rare', name: 'Rare Find' },
  { id: 'noughts', name: DUEL_GAMES.noughts.name },
  { id: 'battleship', name: DUEL_GAMES.battleship.name },
];

// The Arcade's front: anything waiting for you first, then a card per game
// with how far you've got.
export default function ArcadeHome({ profile, uid, duels, incoming, mine, onOpen, onAnswer }: ArcadeHomeProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answer = async (accept: boolean) => {
    setBusy(true); setError(null);
    try { await onAnswer(accept); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't reach the game. Try again."); }
    finally { setBusy(false); }
  };
  const progress = (game: ArcadeGame): string => {
    if (game === 'sorted') return profile.games?.sorted.played ? `${profile.games.sorted.played} played` : 'Four groups of four';
    if (game === 'rare') return profile.games?.rare.answered ? `${profile.games.rare.answered} answered` : 'Name what nobody else would';
    if (mine && isLive(mine) && mine.game === game) {
      if (mine.status === 'offered') return mine.challenger.uid === uid ? 'Challenge sent' : 'Challenge waiting for you';
      return isMyMove(mine, uid) ? 'Your move' : 'In play';
    }
    const live = duels.filter(d => d.game === game && d.status === 'playing').length;
    return live ? `${live} at the table now` : 'Challenge someone';
  };
  const them = (duel: DuelView) => duel.challenger.uid === uid ? duel.opponent.name : duel.challenger.name;

  return (
    <div className="sp-arcade-home">
      {incoming ? (
        <section className="sp-arcade-waiting" aria-label="Duel challenge">
          <p><strong>{incoming.challenger.name} challenges you to {DUEL_GAMES[incoming.game].name.toLowerCase()}</strong>
            {incoming.stake > 0 && <span>🪙 {incoming.stake} each, winner takes both</span>}</p>
          <div>
            <button type="button" className="sp-planning-secondary" disabled={busy} onClick={() => void answer(false)}>Decline</button>
            <button type="button" className="sp-planning-primary" disabled={busy || profile.coins < incoming.stake} onClick={() => void answer(true)}>
              {profile.coins < incoming.stake ? `You need 🪙 ${incoming.stake}` : 'Accept'}
            </button>
          </div>
          {error && <p role="alert" className="sp-arcade-error">{error}</p>}
        </section>
      ) : mine && isMyMove(mine, uid) && (
        <section className="sp-arcade-waiting" aria-label="Your move">
          <p><strong>Your move against {them(mine)}</strong><span>{DUEL_GAMES[mine.game].name}</span></p>
          <div><button type="button" className="sp-planning-primary" onClick={() => onOpen(mine.game)}>Back to the game</button></div>
        </section>
      )}
      <ul className="sp-arcade-cards">
        {GAMES.map(game => (
          <li key={game.id}>
            <button type="button" className="sp-arcade-card" data-game={game.id} onClick={() => onOpen(game.id)}>
              <span className="sp-arcade-art"><Art game={game.id} /></span>
              <span className="sp-arcade-card-text">
                <strong>{game.name}</strong>
                <small>{progress(game.id)}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
