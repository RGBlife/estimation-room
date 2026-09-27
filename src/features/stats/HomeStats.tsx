import { useRef } from 'react';
import { deckShares, formatCount, formatSince } from './homeStats.ts';
import { useHomeStats } from './useHomeStats.ts';

interface TileProps { value: number | string; label: string }

function Tile({ value, label }: TileProps) {
  return (
    <div className="sp-stat">
      <span className="sp-stat-value">{typeof value === 'number' ? formatCount(value) : value}</span>
      <span className="sp-stat-label">{label}</span>
    </div>
  );
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

// "Around the table": live and all-time numbers from the room service, below
// the join screen. Only rendered for the .NET backend; Firebase has no
// equivalent endpoint.
export default function HomeStats() {
  const section = useRef<HTMLElement>(null);
  const state = useHomeStats(section);

  return (
    <section ref={section} className="sp-stats" aria-labelledby="sp-stats-title">
      <div className="sp-stats-inner">
        <h2 id="sp-stats-title" className="sp-stats-divider"><span>Around the table</span></h2>

        {state.kind === 'error' && <p className="sp-stats-note">The stats are taking a coffee break. Try again in a bit.</p>}
        {(state.kind === 'idle' || state.kind === 'loading') && <p className="sp-stats-note" aria-live="polite">Counting cards…</p>}

        {state.kind === 'ready' && (() => {
          const { live, totals, since } = state.stats;
          const decks = deckShares(totals.decks);
          return (
            <>
              <div className="sp-stats-group">
                <h3 className="sp-stats-heading"><span className="sp-stats-live-dot" aria-hidden="true" />Live now</h3>
                <div className="sp-stats-grid sp-stats-grid-live">
                  <Tile value={live.online} label={plural(live.online, 'person online', 'people online')} />
                  <Tile value={live.roomsInUse} label={plural(live.roomsInUse, 'room in use', 'rooms in use')} />
                  <Tile value={live.drivers} label={plural(live.drivers, 'car on the road', 'cars on the road')} />
                </div>
              </div>

              <div className="sp-stats-group">
                <h3 className="sp-stats-heading">All time</h3>
                <div className="sp-stats-grid">
                  <Tile value={totals.votesCast} label="votes cast" />
                  <Tile value={totals.ticketsRefined} label="tickets refined" />
                  <Tile value={totals.roundsRevealed} label="rounds revealed" />
                  <Tile value={totals.roomsCreated} label="rooms created" />
                  <Tile value={totals.thingsThrown} label="things thrown" />
                  <Tile value={totals.nudges} label="nudges sent" />
                  <Tile value={totals.gtaRides} label="GTA rides" />
                  <Tile value={totals.carsWrecked} label="cars wrecked" />
                </div>
              </div>

              {decks.length > 0 && (
                <div className="sp-stats-group">
                  <h3 className="sp-stats-heading">Favourite decks</h3>
                  <ul className="sp-deck-bars">
                    {decks.map(deck => {
                      const percent = Math.round(deck.share * 100);
                      return (
                        <li key={deck.id} className="sp-deck-bar" title={`${deck.name}: ${formatCount(deck.count)} ${plural(deck.count, 'room', 'rooms')}`}>
                          <span className="sp-deck-bar-name">{deck.name}</span>
                          <span className="sp-deck-bar-track" aria-hidden="true"><span style={{ width: `${Math.max(percent, 1)}%` }} /></span>
                          <span className="sp-deck-bar-value">{percent}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <p className="sp-stats-footer">
                {state.ping !== null && <>Your ping to the server: <strong>{state.ping} ms</strong> · </>}
                {formatCount(totals.storedRooms)} {plural(totals.storedRooms, 'room', 'rooms')} kept · counting since {formatSince(since)}
              </p>
            </>
          );
        })()}
      </div>
    </section>
  );
}
