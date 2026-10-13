import { useEffect, useRef, useState } from 'react';
import Countdown, { ClockBar } from './Countdown.tsx';
import { points, spell, touching, SIZE } from '../play/words.ts';
import { isWord, loadWordList, wordListReady } from '../play/wordList.ts';
import { nameFor, sideTone, sidesOf, type BoardProps } from './types.ts';

// Sixteen letter tiles. Drag through them to trace a word (back onto the
// last tile to undo it), or tap them one by one and press Enter. The word
// so far shows above, with what it's worth once it's a word; a word that
// counts flashes the tiles and floats its points up.
export default function WordsBoard({ duel, uid, player, playable, onMove, clock }: BoardProps) {
  const grid = duel.grid ?? [];
  const [path, setPath] = useState<number[]>([]);
  const [said, setSaid] = useState<{ text: string; good: boolean; key: number } | null>(null);
  const [, setLoaded] = useState(wordListReady());
  const board = useRef<HTMLDivElement>(null);
  // A drag in progress, and whether it has gone over more than one tile.
  const drag = useRef({ on: false, moved: false });
  useEffect(() => { void loadWordList().then(() => setLoaded(true)); }, []);
  const running = playable && !clock.startsIn;
  const mine = (uid && duel.words?.[uid]) || [];
  const word = spell(grid, path);
  const known = wordListReady() && word.length >= 3 && isWord(word);
  const found = mine.includes(word);

  const extend = (cell: number) => setPath(p => {
    if (p.length > 1 && p[p.length - 2] === cell) return p.slice(0, -1);
    if (p.includes(cell) || (p.length > 0 && !touching(p[p.length - 1], cell))) return p;
    return [...p, cell];
  });
  const submit = async (traced = path) => {
    setPath([]);
    if (!running || traced.length === 0) return;
    const text = spell(grid, traced);
    if (text.length < 3) { setSaid({ text: 'Three letters or more', good: false, key: Date.now() }); return; }
    try { await onMove({ path: traced }); setSaid({ text: `${text.toUpperCase()} +${points(text.length)}`, good: true, key: Date.now() }); }
    catch (e) { setSaid({ text: e instanceof Error ? e.message : String(e), good: false, key: Date.now() }); }
  };
  // The tile under the pointer, counting only its middle, so a diagonal
  // drag doesn't catch the corners of the tiles beside it.
  const tileAt = (x: number, y: number) => {
    const tile = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-cell]');
    if (!tile) return null;
    const box = tile.getBoundingClientRect();
    const inside = Math.hypot(x - (box.left + box.width / 2), y - (box.top + box.height / 2)) < box.width * 0.42;
    return inside ? Number(tile.dataset.cell) : null;
  };

  const { near, far } = sidesOf(duel, uid);
  const centre = (cell: number) => [((cell % SIZE) + 0.5) * 100 / SIZE, (Math.floor(cell / SIZE) + 0.5) * 100 / SIZE];
  const over = duel.status !== 'playing';
  return (
    <div className="sp-words">
      <ClockBar left={clock.endsIn} total={duel.limitMs} />
      <div className="sp-words-scores">
        {[near, far].map(side => (
          <span key={side.uid} data-tone={sideTone(duel, side.uid)}>
            {nameFor(side, uid)} <b>{(duel.scores?.[side.uid] ?? 0).toLocaleString('en-GB')}</b>
            <small>{duel.counts?.[side.uid] ?? 0} words</small>
          </span>
        ))}
      </div>
      <p className="sp-words-current" data-state={path.length === 0 ? 'empty' : found ? 'found' : known ? 'word' : 'trying'} aria-live="polite">
        {path.length > 0 ? <>{word.toUpperCase()}{known && <small>{found ? 'found' : `+${points(word.length)}`}</small>}</>
          : said ? <span key={said.key} data-good={said.good}>{said.text}</span>
          : <span>{player && !over ? 'Drag through the letters' : ' '}</span>}
      </p>
      <div ref={board} className="sp-words-grid" data-tracing={path.length > 0 || undefined}
        onPointerDown={event => {
          if (!running) return;
          const cell = tileAt(event.clientX, event.clientY);
          if (cell === null) return;
          event.preventDefault();
          board.current?.setPointerCapture?.(event.pointerId);
          drag.current = { on: true, moved: false };
          // A tap next to the word so far carries on from it; anywhere else starts afresh.
          const last = path[path.length - 1];
          if (last !== undefined && (touching(last, cell) || path[path.length - 2] === cell) && !path.slice(0, -2).includes(cell)) extend(cell);
          else setPath([cell]);
        }}
        onPointerMove={event => {
          if (!drag.current.on) return;
          const cell = tileAt(event.clientX, event.clientY);
          if (cell !== null && cell !== path[path.length - 1]) { drag.current.moved = true; extend(cell); }
        }}
        onPointerUp={() => {
          const { on, moved } = drag.current;
          drag.current = { on: false, moved: false };
          if (on && moved && path.length > 1) void submit();
        }}
        onPointerCancel={() => { drag.current = { on: false, moved: false }; setPath([]); }}>
        {grid.map((letter, cell) => (
          <button key={cell} type="button" className="sp-words-tile" data-cell={cell} data-on={path.includes(cell) || undefined}
            data-good={(path.includes(cell) && known && !found) || undefined} disabled={!running}
            aria-label={`${letter}${path.includes(cell) ? ', chosen' : ''}`} aria-pressed={path.includes(cell)}
            onClick={event => { if (event.detail === 0) extend(cell); }}>
            {letter === 'QU' ? <>Q<small>u</small></> : letter}
          </button>
        ))}
        {path.length > 1 && (
          <svg className="sp-words-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={path.map(c => centre(c).join(',')).join(' ')} />
          </svg>
        )}
        <Countdown ms={clock.startsIn} />
      </div>
      {player && !over && (
        <div className="sp-sorted-controls">
          <button type="button" className="sp-planning-secondary" disabled={path.length === 0} onClick={() => setPath([])}>Clear</button>
          <button type="button" className="sp-planning-primary" disabled={!running || path.length < 3} onClick={() => void submit()}>Enter</button>
        </div>
      )}
      <div className="sp-words-lists">
        {[near, far].map(side => {
          const words = duel.words?.[side.uid];
          if (!words) return null;
          return (
            <div key={side.uid} className="sp-rare-answers">
              <h4>{side.uid === uid ? 'Your words' : `${side.name}'s words`}</h4>
              <ol>{[...words].reverse().map(w => <li key={w}><span>{w}</span><b>{points(w.length)}</b></li>)}</ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}
