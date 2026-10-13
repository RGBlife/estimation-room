import { useState } from 'react';
import { participantAvatarSrc } from '../avatar/index.js';
import ArcadeArt from './ArcadeArt.tsx';
import { DUEL_GAMES, SECTIONS, duelTitle, gameName, type ArcadeGame } from './catalogue.ts';
import { readRecords, shortRecord } from './bests.ts';
import { isBusy, isLive, isMyMove } from './duels.ts';
import type { PlayerProfile } from '../../types/player.ts';
import type { Participant } from '../../types/room.ts';
import type { DuelView } from '../../types/games.ts';

interface ArcadeHomeProps {
  profile: PlayerProfile;
  uid: string | null;
  // Who's at the table, for the faces you could challenge.
  participants?: Record<string, Participant>;
  duels: DuelView[];
  // A challenge waiting for your answer, and the duel you're in, if any.
  incoming: DuelView | null;
  mine: DuelView | null;
  onOpen: (game: ArcadeGame) => void;
  onAnswer: (accept: boolean) => Promise<void>;
}

const FACES = 4;

// The Arcade's front: anything waiting for you first, then a card per game
// with how far you've got, in two sections: solo puzzles, and duels (quick-
// fire and thinky), each of which can be practised against the computer.
export default function ArcadeHome({ profile, uid, participants = {}, duels, incoming, mine, onOpen, onAnswer }: ArcadeHomeProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records] = useState(readRecords);
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
      return isMyMove(mine, uid) ? (mine.turn ? 'Your move' : 'Game on') : 'In play';
    }
    const live = duels.filter(d => d.game === game && d.status === 'playing').length;
    if (live) return `${live} at the table now`;
    return shortRecord(game, records[game]) ?? DUEL_GAMES[game].tagline;
  };
  const them = (duel: DuelView) => duel.challenger.uid === uid ? duel.opponent.name : duel.challenger.name;
  // Everyone you could challenge now: at the table and not in a duel.
  const free = Object.entries(participants).filter(([id]) => id !== uid && !isBusy(duels, id));

  return (
    <div className="sp-arcade-home">
      {incoming ? (
        <section className="sp-arcade-waiting" aria-label="Duel challenge">
          <p><strong>{incoming.challenger.name} challenges you to {DUEL_GAMES[incoming.game].phrase}</strong>
            {incoming.options?.text && <span>{duelTitle(incoming.game, incoming.options)}</span>}
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
          <p><strong>{mine.turn ? 'Your move' : 'Your game'} against {them(mine)}</strong><span>{DUEL_GAMES[mine.game].name}</span></p>
          <div><button type="button" className="sp-planning-primary" onClick={() => onOpen(mine.game)}>Back to the game</button></div>
        </section>
      )}
      {SECTIONS.map(section => (
        <section key={section.id} className="sp-arcade-section" data-section={section.id} aria-labelledby={`sp-arcade-section-${section.id}`}>
          <div className="sp-arcade-section-heading">
            <h3 id={`sp-arcade-section-${section.id}`}>{section.title}</h3>
            {section.id === 'duels' && free.length > 0 && (
              <span className="sp-arcade-faces" aria-label={`${free.length} free to duel`}>
                {free.slice(0, FACES).map(([id, person]) => <img key={id} src={participantAvatarSrc(person)} alt="" width={26} height={26} />)}
                {free.length > FACES && <b aria-hidden="true">+{free.length - FACES}</b>}
              </span>
            )}
            <p>{section.lead}</p>
          </div>
          {section.shelves.map(shelf => (
            <div key={shelf.id} className="sp-arcade-shelf" data-shelf={shelf.id} role="group" aria-label={section.shelves.length > 1 ? shelf.title : section.title}>
              {section.shelves.length > 1 && <h4>{shelf.title}</h4>}
              <ul className="sp-arcade-cards">
                {shelf.games.map(game => (
                  <li key={game}>
                    <button type="button" className="sp-arcade-card" data-game={game} onClick={() => onOpen(game)}>
                      <span className="sp-arcade-art"><ArcadeArt game={game} /></span>
                      <span className="sp-arcade-card-text">
                        <strong>{game === 'ultimate' ? 'Ultimate noughts' : gameName(game)}</strong>
                        <small>{progress(game)}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
