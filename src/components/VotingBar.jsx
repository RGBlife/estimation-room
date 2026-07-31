import { useEffect, useState } from 'react';
import { CARD_VALUES } from '../lib/avatar.js';

const MAX_BAR_HEIGHT = 64;
const MIN_BAR_HEIGHT = 18;
const STAGGER_MS = 45;
const VOTE_ROW_EXIT_MS = 260;

function DistributionBar({ distribution, hasAverage, average, isWideSpread, onStartNextRound, hoveredValue, onHoverValue }) {
  const maxCount = Math.max(1, ...distribution.map(d => d.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
        {distribution.map((d, i) => {
          const dimmed = hoveredValue != null && hoveredValue !== d.value;
          return (
            <div
              key={d.value}
              className="sp-dist-column"
              onMouseEnter={() => onHoverValue(d.value)}
              onMouseLeave={() => onHoverValue(null)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'default', opacity: dimmed ? 0.35 : 1, transition: 'opacity 0.15s ease', animationDelay: `${i * STAGGER_MS}ms` }}
            >
              <div
                className="sp-dist-bar"
                style={{
                  width: 38,
                  height: Math.round(MIN_BAR_HEIGHT + (d.count / maxCount) * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)),
                  background: d.isTop ? 'var(--sp-accent)' : 'var(--sp-bar-track)',
                  borderRadius: '5px 5px 0 0',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 4,
                  animationDelay: `${i * STAGGER_MS}ms`,
                }}
              >
                <span style={{ fontFamily: 'var(--sp-mono)', fontSize: 11, fontWeight: 700, color: d.isTop ? 'var(--sp-bg)' : 'var(--sp-text-dim)' }}>{d.count}</span>
              </div>
              <div style={{ fontFamily: 'var(--sp-mono)', fontSize: 14, fontWeight: 700, color: 'var(--sp-text)' }}>{d.value}</div>
            </div>
          );
        })}

        {hasAverage && (
          <div
            className="sp-dist-average"
            style={{
              textAlign: 'center', paddingLeft: 8, borderLeft: '1px solid var(--sp-border)', marginLeft: 4,
              animationDelay: `${distribution.length * STAGGER_MS}ms`,
            }}
          >
            <div style={{ fontFamily: 'var(--sp-mono)', fontSize: 24, fontWeight: 700, color: 'var(--sp-text)' }}>{average}</div>
            <div style={{ fontSize: 11, color: 'var(--sp-text-faint)', marginTop: 2 }}>average</div>
          </div>
        )}
      </div>

      {isWideSpread && (
        <div
          className="sp-dist-average"
          style={{
            background: 'var(--sp-warn-bg)', border: '1px solid var(--sp-warn-border)', color: 'var(--sp-warn-text)',
            padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            animationDelay: `${distribution.length * STAGGER_MS + 80}ms`,
          }}
        >⚠ Wide spread — discuss?</div>
      )}

      <button
        onClick={onStartNextRound}
        style={{ background: 'var(--sp-accent)', border: 'none', borderRadius: 8, padding: '10px 18px', color: 'var(--sp-bg)', fontFamily: 'var(--sp-font)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
      >Start next round</button>
    </div>
  );
}

function VoteCardRow({ myVote, onSelect, exiting }) {
  return (
    <>
      <span style={{ fontSize: 11, color: 'var(--sp-text-faintest)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, whiteSpace: 'nowrap' }}>Your vote</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {CARD_VALUES.map((value, i) => {
          const selected = value === myVote;
          return (
            <button
              key={value}
              onClick={() => onSelect(value)}
              className={exiting ? 'sp-vote-card-exit' : 'sp-vote-card-enter'}
              style={{
                ...(selected ? {
                  width: 42, height: 58, borderRadius: 8, background: 'var(--sp-accent-panel)', border: '2px solid var(--sp-accent)',
                  boxShadow: '0 0 0 3px var(--sp-accent-glow)', color: 'var(--sp-accent-on-card)', fontFamily: 'var(--sp-mono)',
                  fontSize: 16, fontWeight: 700, cursor: 'pointer', transform: exiting ? undefined : 'translateY(-6px)', transition: 'transform 0.15s ease',
                } : {
                  width: 42, height: 58, borderRadius: 8, background: 'var(--sp-card-bg)', border: '1.5px solid var(--sp-border-strong)',
                  color: 'var(--sp-text-dim)', fontFamily: 'var(--sp-mono)', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }),
                animationDelay: `${(exiting ? CARD_VALUES.length - 1 - i : i) * 20}ms`,
              }}
            >{value}</button>
          );
        })}
      </div>
    </>
  );
}

export default function VotingBar({
  isObserver, myVote, isRevealed, onSelect, onJoinVoting,
  distribution, hasAverage, average, isWideSpread, onStartNextRound,
  hoveredValue, onHoverValue,
}) {
  // The vote-card row stays mounted briefly after reveal so it can animate
  // out instead of being swapped for the distribution bar instantly.
  const [showExitingCards, setShowExitingCards] = useState(false);
  useEffect(() => {
    if (isRevealed) {
      setShowExitingCards(true);
      const t = setTimeout(() => setShowExitingCards(false), VOTE_ROW_EXIT_MS);
      return () => clearTimeout(t);
    }
    setShowExitingCards(false);
  }, [isRevealed]);

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--sp-panel)', borderTop: '1px solid var(--sp-border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
      {isRevealed ? (
        showExitingCards && !isObserver ? (
          <VoteCardRow myVote={myVote} onSelect={onSelect} exiting />
        ) : (
          <DistributionBar
            distribution={distribution}
            hasAverage={hasAverage}
            average={average}
            isWideSpread={isWideSpread}
            onStartNextRound={onStartNextRound}
            hoveredValue={hoveredValue}
            onHoverValue={onHoverValue}
          />
        )
      ) : !isObserver ? (
        <VoteCardRow myVote={myVote} onSelect={onSelect} />
      ) : (
        <>
          <span style={{ fontSize: 13, color: 'var(--sp-text-faintest)' }}>You're observing this round — no vote needed.</span>
          <button onClick={onJoinVoting} style={{ background: 'none', border: '1px solid var(--sp-border-strong)', borderRadius: 7, padding: '7px 14px', color: 'var(--sp-text-dim)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Join voting</button>
        </>
      )}
    </div>
  );
}
