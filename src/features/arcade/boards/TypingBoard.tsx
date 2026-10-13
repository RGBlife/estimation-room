import { useEffect, useRef, useState } from 'react';
import Countdown, { ClockBar } from './Countdown.tsx';
import { wpm } from '../play/typing.ts';
import { nameFor, sideTone, sidesOf, type BoardProps } from './types.ts';

// A race track above the line: a car for each of you, moving as you type,
// with each racer's speed beside it. The line shows what you've typed right
// in your colour, the next character underlined, and a slip in red until you
// fix it. Your progress goes to the other side as you type; the finish goes
// as a move. Speed is words a minute (five characters a word) since the
// race began, on the race's own clock, so both racers are timed alike.
const STEER_MS = 150;
const KIND = { code: 'Code', story: 'Story', quotes: 'Quote', words: 'Common words' } as const;

export default function TypingBoard({ duel, uid, player, playable, onMove, onSteer, clock }: BoardProps) {
  const text = duel.text ?? '';
  const [typed, setTyped] = useState('');
  // Keys pressed that made a slip, for your accuracy.
  const [keys, setKeys] = useState({ all: 0, slips: 0 });
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const sent = useRef({ at: 0, typed: 0 });
  const running = playable && !clock.startsIn;
  let right = 0;
  while (right < typed.length && typed[right] === text[right]) right++;
  const slipped = typed.length > right;

  useEffect(() => { if (running) input.current?.focus(); }, [running]);

  const change = (value: string) => {
    if (!running) return;
    // Each character added counts; a slip is one that doesn't match, or
    // that follows a slip not yet fixed.
    if (value.length > typed.length) {
      const added = [...value.slice(typed.length)];
      const clean = right === typed.length;
      const slips = added.filter((c, i) => !clean || c !== text[typed.length + i]).length;
      setKeys(k => ({ all: k.all + added.length, slips: k.slips + slips }));
    }
    setTyped(value); setError(null);
    let ok = 0;
    while (ok < value.length && value[ok] === text[ok]) ok++;
    if (value === text) { void onMove({ text: value }).catch(e => setError(e instanceof Error ? e.message : String(e))); return; }
    const at = performance.now();
    if (ok !== sent.current.typed && at - sent.current.at >= STEER_MS) { sent.current = { at, typed: ok }; onSteer({ typed: ok }); }
  };
  // Whatever wasn't sent before a pause in typing goes now.
  useEffect(() => {
    if (!running || right === sent.current.typed) return;
    const timer = setTimeout(() => { sent.current = { at: performance.now(), typed: right }; onSteer({ typed: right }); }, STEER_MS);
    return () => clearTimeout(timer);
  }, [running, right, onSteer]);

  const { near, far } = sidesOf(duel, uid);
  // How long the race has run: the clock counts down from the limit, and
  // once the race is over, the time it ended at stays.
  const live = duel.limitMs !== undefined && clock.endsIn !== undefined && !clock.startsIn ? duel.limitMs - clock.endsIn : null;
  const [ended, setEnded] = useState(0);
  if (live !== null && live !== ended) setEnded(live);
  const elapsed = live ?? ended;
  const progressOf = (id: string) => id === uid && player ? right : duel.typed?.[id] ?? 0;
  const speedOf = (id: string) => {
    const finished = duel.finished?.[id];
    return finished !== undefined ? wpm(text.length, finished) : wpm(progressOf(id), elapsed);
  };
  const accuracy = keys.all ? Math.round((1 - keys.slips / keys.all) * 100) : 100;
  const over = duel.status !== 'playing';
  return (
    <div className="sp-typing">
      <ClockBar left={clock.endsIn} total={duel.limitMs} />
      <div className="sp-typing-track">
        {[near, far].map(side => {
          const done = text.length ? Math.min(1, progressOf(side.uid) / text.length) : 0;
          return (
            <div key={side.uid} className="sp-typing-lane" data-tone={sideTone(duel, side.uid)}>
              <span className="sp-typing-name">{nameFor(side, uid)}</span>
              <div className="sp-typing-road">
                {/* A low racer, nose to the finish on the right. */}
                <svg className="sp-typing-car" viewBox="0 0 40 20" aria-hidden="true" style={{ left: `calc(${done * 100}% - ${done * 34}px)` }}>
                  <path d="M2 7h6v3H2z" />
                  <path d="M3 15v-4l5-1 4-4h9l5 4 10 1.5c1.5.2 2.5 1.2 2.5 2.5V15z" />
                  <path d="M14 7.5h6l3 2.5h-11z" className="sp-typing-window" />
                  <circle cx="10" cy="16" r="3" /><circle cx="31" cy="16" r="3" />
                </svg>
                <i className="sp-typing-flag" aria-hidden="true" />
              </div>
              <span className="sp-typing-speed" aria-label={`${speedOf(side.uid)} words a minute`}>{speedOf(side.uid)} <small>wpm</small></span>
            </div>
          );
        })}
      </div>
      <div className="sp-typing-text" aria-label={text}>
        {duel.kind && <small className="sp-typing-kind">{KIND[duel.kind]}</small>}
        <span className="sp-typing-done">{text.slice(0, right)}</span>
        {slipped && <span className="sp-typing-slip">{text.slice(right, typed.length) || ' '}</span>}
        <span className="sp-typing-next">{text.slice(slipped ? typed.length : right, (slipped ? typed.length : right) + 1)}</span>
        <span>{text.slice((slipped ? typed.length : right) + 1)}</span>
        {duel.credit && over && <cite className="sp-typing-credit">{duel.credit}</cite>}
        <Countdown ms={clock.startsIn} />
      </div>
      {player && (
        <div className="sp-typing-entry">
          <input ref={input} className="sp-rare-input sp-typing-input" value={typed} disabled={!running} aria-label="Type the line"
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-slip={slipped || undefined}
            onChange={event => change(event.target.value)} onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()} />
          <span className="sp-typing-accuracy" aria-label={`${accuracy}% accurate`}>{accuracy}%<small>accuracy</small></span>
        </div>
      )}
      {error && <p role="alert" className="sp-arcade-error">{error}</p>}
    </div>
  );
}
