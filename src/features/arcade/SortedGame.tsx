import { useEffect, useState } from 'react';
import type { SortedGroup, SortedMove, SortedView } from '../../types/games.ts';

const FEEDBACK: Record<NonNullable<SortedView['result']>, string | null> = {
  correct: null,
  'one-away': 'One away…',
  wrong: 'Not a group.',
  repeat: "You've already tried that one.",
};

// Keeps the player's own arrangement of the tiles across moves, so a
// shuffle survives a guess; tiles that left the board drop out.
function arrange(current: string[], tiles: string[]): string[] {
  const kept = current.filter(t => tiles.includes(t));
  return kept.length === tiles.length ? kept : tiles;
}

function shuffle(tiles: string[]): string[] {
  const next = [...tiles];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function Band({ group, missed = false }: { group: SortedGroup; missed?: boolean }) {
  return (
    <li className="sp-sorted-band" data-level={group.level} data-missed={missed}>
      <strong>{group.name}</strong>
      <span>{group.items.join(', ')}</span>
    </li>
  );
}

// Sixteen tiles, four hidden groups of four, three mistakes allowed. The
// service checks every guess; this keeps only the selection and the order.
export default function SortedGame({ play }: { play: (move: SortedMove) => Promise<SortedView> }) {
  const [view, setView] = useState<SortedView | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped on a wrong guess, to replay the shake.
  const [miss, setMiss] = useState(0);

  const run = async (move: SortedMove) => {
    setBusy(true); setError(null);
    try {
      const next = await play(move);
      setView(next);
      setOrder(current => arrange(current, next.tiles));
      setFeedback(next.result ? FEEDBACK[next.result] : null);
      if (next.result === 'correct' || move.operation !== 'guess') setSelected([]);
      if (next.result === 'wrong' || next.result === 'one-away') setMiss(n => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the game. Try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void run({ operation: 'open' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!view) {
    return <div className="sp-sorted">{error ? <p role="alert" className="sp-arcade-error">{error}</p> : <p className="sp-sorted-hint">Dealing a puzzle…</p>}</div>;
  }

  const toggle = (tile: string) => setSelected(current =>
    current.includes(tile) ? current.filter(t => t !== tile) : current.length < 4 ? [...current, tile] : current);
  const mistakes = 3 - view.lives;

  return (
    <div className="sp-sorted">
      <div className="sp-sorted-heading">
        <h3>Sorted #{view.number}</h3>
        <p className="sp-sorted-hint">Find four groups of four.</p>
      </div>

      {view.found.length > 0 && <ul className="sp-sorted-bands">{view.found.map(group => <Band key={group.name} group={group} />)}</ul>}

      {view.finished ? (
        <div className="sp-sorted-result">
          {view.missed && view.missed.length > 0 && <ul className="sp-sorted-bands">{view.missed.map(group => <Band key={group.name} group={group} missed />)}</ul>}
          <p className="sp-sorted-outcome">
            <strong>{view.won ? (mistakes === 0 ? 'Sorted, with no mistakes' : `Sorted, with ${mistakes} mistake${mistakes === 1 ? '' : 's'}`) : 'Out of mistakes'}</strong>
            <span>{view.replay ? "Replays don't earn coins." : view.paid ? `+${view.paid} coins` : "You've reached today's coin limit."}</span>
          </p>
          <button type="button" className="sp-planning-primary" disabled={busy} onClick={() => void run({ operation: 'next' })}>Next puzzle</button>
        </div>
      ) : (
        <>
          <div className="sp-sorted-grid" role="group" aria-label="Tiles">
            {order.map(tile => {
              const isSelected = selected.includes(tile);
              return (
                <button key={tile} type="button" className="sp-sorted-tile" aria-pressed={isSelected}
                  data-miss={isSelected && miss > 0 ? miss % 2 : undefined}
                  disabled={busy || (!isSelected && selected.length === 4)} onClick={() => toggle(tile)}>
                  {tile}
                </button>
              );
            })}
          </div>
          <div className="sp-sorted-status">
            <span className="sp-sorted-lives" aria-label={`${view.lives} mistake${view.lives === 1 ? '' : 's'} left`}>
              Mistakes left {Array.from({ length: 3 }, (_, i) => <i key={i} data-spent={i >= view.lives} aria-hidden="true" />)}
            </span>
            <span role="status" className="sp-sorted-feedback">{feedback}</span>
          </div>
          <div className="sp-sorted-controls">
            <button type="button" className="sp-planning-secondary" disabled={busy} onClick={() => setOrder(shuffle)}>Shuffle</button>
            <button type="button" className="sp-planning-secondary" disabled={busy || selected.length === 0} onClick={() => setSelected([])}>Deselect all</button>
            <button type="button" className="sp-planning-primary" disabled={busy || selected.length !== 4} onClick={() => void run({ operation: 'guess', items: selected })}>Submit</button>
          </div>
        </>
      )}
      {error && <p role="alert" className="sp-arcade-error">{error}</p>}
    </div>
  );
}
