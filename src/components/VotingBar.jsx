import { CARD_VALUES } from '../lib/avatar.js';
import { participantAvatarSrc } from '../lib/avatar.js';

const MAX_BAR_HEIGHT = 64;
const MIN_BAR_HEIGHT = 18;

function DistributionBar({ distribution, hasAverage, average, isWideSpread, onStartNextRound }) {
  const maxCount = Math.max(1, ...distribution.map(d => d.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
        {distribution.map(d => (
          <div key={d.value} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 4, alignItems: 'center', minHeight: 26 }}>
              {d.voters.map((v, i) => (
                <img
                  key={i}
                  src={participantAvatarSrc(v)}
                  alt=""
                  style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid var(--sp-panel)', display: 'block' }}
                />
              ))}
            </div>
            <div
              style={{
                width: 38,
                height: Math.round(MIN_BAR_HEIGHT + (d.count / maxCount) * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)),
                background: d.isTop ? 'var(--sp-accent)' : 'var(--sp-bar-track)',
                borderRadius: '5px 5px 0 0',
              }}
            />
            <div style={{ fontFamily: 'var(--sp-mono)', fontSize: 14, fontWeight: 700, color: 'var(--sp-text)' }}>{d.value}</div>
          </div>
        ))}

        {hasAverage && (
          <div style={{ textAlign: 'center', paddingLeft: 8, borderLeft: '1px solid var(--sp-border)', marginLeft: 4 }}>
            <div style={{ fontFamily: 'var(--sp-mono)', fontSize: 24, fontWeight: 700, color: 'var(--sp-text)' }}>{average}</div>
            <div style={{ fontSize: 11, color: 'var(--sp-text-faint)', marginTop: 2 }}>average</div>
          </div>
        )}
      </div>

      {isWideSpread && (
        <div style={{ background: 'var(--sp-warn-bg)', border: '1px solid var(--sp-warn-border)', color: 'var(--sp-warn-text)', padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>⚠ Wide spread — discuss?</div>
      )}

      <button
        onClick={onStartNextRound}
        style={{ background: 'var(--sp-accent)', border: 'none', borderRadius: 8, padding: '10px 18px', color: 'var(--sp-bg)', fontFamily: 'var(--sp-font)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
      >Start next round</button>
    </div>
  );
}

export default function VotingBar({
  isObserver, myVote, isRevealed, onSelect, onJoinVoting,
  distribution, hasAverage, average, isWideSpread, onStartNextRound,
}) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--sp-panel)', borderTop: '1px solid var(--sp-border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
      {isRevealed ? (
        <DistributionBar
          distribution={distribution}
          hasAverage={hasAverage}
          average={average}
          isWideSpread={isWideSpread}
          onStartNextRound={onStartNextRound}
        />
      ) : !isObserver ? (
        <>
          <span style={{ fontSize: 11, color: 'var(--sp-text-faintest)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, whiteSpace: 'nowrap' }}>Your vote</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {CARD_VALUES.map(value => {
              const selected = value === myVote;
              return (
                <button
                  key={value}
                  onClick={() => onSelect(value)}
                  style={selected ? {
                    width: 42, height: 58, borderRadius: 8, background: 'var(--sp-accent-panel)', border: '2px solid var(--sp-accent)',
                    boxShadow: '0 0 0 3px var(--sp-accent-glow)', color: 'var(--sp-accent-on-card)', fontFamily: 'var(--sp-mono)',
                    fontSize: 16, fontWeight: 700, cursor: 'pointer', transform: 'translateY(-6px)', transition: 'transform 0.15s ease',
                  } : {
                    width: 42, height: 58, borderRadius: 8, background: 'var(--sp-card-bg)', border: '1.5px solid var(--sp-border-strong)',
                    color: 'var(--sp-text-dim)', fontFamily: 'var(--sp-mono)', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                  }}
                >{value}</button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <span style={{ fontSize: 13, color: 'var(--sp-text-faintest)' }}>You're observing this round — no vote needed.</span>
          <button onClick={onJoinVoting} style={{ background: 'none', border: '1px solid var(--sp-border-strong)', borderRadius: 7, padding: '7px 14px', color: 'var(--sp-text-dim)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Join voting</button>
        </>
      )}
    </div>
  );
}
