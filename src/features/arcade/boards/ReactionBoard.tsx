import { useEffect, useState } from 'react';
import Countdown from './Countdown.tsx';
import { FIRST_TO } from '../play/reaction.ts';
import { nameFor, sideTone, sidesOf, type BoardProps } from './types.ts';

// One big pad: red while you wait, green the instant it's time, and the
// round's verdict after. It answers to the first touch (not the release),
// and to the space bar. Rounds won show as pips beside each name.
export default function ReactionBoard({ duel, uid, player, playable, onMove, clock }: BoardProps) {
  const round = duel.round ?? 1;
  const [tapped, setTapped] = useState(0);
  const phase = clock.startsIn ? 'ready' : duel.phase ?? 'ready';
  const tap = () => {
    if (!playable || tapped === round || (phase !== 'wait' && phase !== 'go')) return;
    setTapped(round);
    void onMove({ round }).catch(() => {});
  };
  useEffect(() => {
    if (!player) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || (event.target as HTMLElement)?.closest?.('input, textarea')) return;
      event.preventDefault(); tap();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const { near, far } = sidesOf(duel, uid);
  const result = duel.result;
  const verdict = phase !== 'result' || !result ? null
    : result.void ? 'Nobody tapped. Again!'
    : result.early ? `${nameFor(result.early === near.uid ? near : far, uid)} jumped the gun`
    : `${nameFor(result.winner === near.uid ? near : far, uid)}${result.winner === uid ? ' were' : ' was'} quicker`;
  const text = phase === 'ready' ? 'Get ready' : phase === 'wait' ? (tapped === round ? 'Too soon!' : 'Wait for green…') : phase === 'go' ? (tapped === round ? 'Tapped' : 'Tap!') : verdict;
  return (
    <div className="sp-reaction">
      <div className="sp-reaction-score">
        {[near, far].map(side => (
          <span key={side.uid} data-tone={sideTone(duel, side.uid)}>
            {nameFor(side, uid)}
            <i aria-label={`${duel.won?.[side.uid] ?? 0} of ${FIRST_TO} rounds`}>
              {Array.from({ length: FIRST_TO }, (_, i) => <b key={i} data-won={i < (duel.won?.[side.uid] ?? 0) || undefined} />)}
            </i>
          </span>
        ))}
      </div>
      <button type="button" className="sp-reaction-pad" data-phase={phase} disabled={!player || duel.status !== 'playing'}
        onPointerDown={event => { event.preventDefault(); tap(); }} onKeyDown={event => { if (event.key === 'Enter') tap(); }}
        aria-label={`Round ${round}: ${text}`}>
        <small>Round {round}</small>
        <strong>{text}</strong>
        {phase === 'result' && result?.ms !== undefined && <span className="sp-reaction-ms" key={round}>{result.ms} ms</span>}
        <Countdown ms={clock.startsIn} />
      </button>
    </div>
  );
}
