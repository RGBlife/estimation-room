import { useEffect, useRef, useState } from 'react';
import Countdown, { ClockBar } from './Countdown.tsx';
import { COUNT } from '../play/maths.ts';
import { nameFor, sideTone, sidesOf, type BoardProps } from './types.ts';

// A card with the sum you're on, and a row of ten pips for each of you.
// A right answer slides the card away and the next one in; a wrong one
// shakes it and holds you for a moment.
export default function MathsBoard({ duel, uid, player, playable, onMove, clock }: BoardProps) {
  const sums = duel.sums ?? [];
  const done = (id: string) => duel.answered?.[id] ?? 0;
  const at = uid ? done(uid) : 0;
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(0);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const running = playable && !clock.startsIn && at < COUNT;
  useEffect(() => { if (running) input.current?.focus(); }, [running, at]);

  const submit = async () => {
    const value = Number(answer.trim());
    if (!running || busy || answer.trim() === '' || !Number.isInteger(value)) return;
    setBusy(true);
    try { await onMove({ answer: value }); setAnswer(''); }
    catch (e) { if (!(e instanceof Error && e.message === 'Steady')) { setWrong(w => w + 1); setAnswer(''); } }
    finally { setBusy(false); }
  };

  const { near, far } = sidesOf(duel, uid);
  return (
    <div className="sp-maths">
      <ClockBar left={clock.endsIn} total={duel.limitMs} />
      <div className="sp-maths-lanes">
        {[near, far].map(side => (
          <div key={side.uid} className="sp-maths-lane" data-tone={sideTone(duel, side.uid)}>
            <span>{nameFor(side, uid)}</span>
            <i aria-label={`${done(side.uid)} of ${COUNT} answered`}>
              {Array.from({ length: COUNT }, (_, i) => <b key={i} data-done={i < done(side.uid) || undefined} />)}
            </i>
          </div>
        ))}
      </div>
      {player && (
        <form className="sp-maths-card" key={at} data-wrong={wrong ? wrong % 2 : undefined} onSubmit={event => { event.preventDefault(); void submit(); }}>
          <Countdown ms={clock.startsIn} />
          {at < COUNT ? (
            <>
              <small>Sum {at + 1} of {COUNT}</small>
              <label className="sp-maths-sum">
                <span>{sums[at] ?? ''} =</span>
                <input ref={input} className="sp-rare-input" inputMode="numeric" pattern="-?[0-9]*" autoComplete="off" value={answer} disabled={!running}
                  aria-label={`${sums[at] ?? 'The sum'} equals`} onChange={event => setAnswer(event.target.value.replace(/[^0-9-]/g, ''))} />
              </label>
              <button type="submit" className="sp-planning-primary" disabled={!running || busy || answer === ''}>Answer</button>
            </>
          ) : <strong className="sp-maths-done">All ten!</strong>}
        </form>
      )}
    </div>
  );
}
