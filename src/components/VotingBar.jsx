import { CARD_VALUES } from '../lib/avatar.js';

export default function VotingBar({ isObserver, myVote, isRevealed, onSelect, onJoinVoting }) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--sp-panel)', borderTop: '1px solid var(--sp-border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
      {!isObserver ? (
        <>
          <span style={{ fontSize: 11, color: 'var(--sp-text-faintest)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, whiteSpace: 'nowrap' }}>Your vote</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {CARD_VALUES.map(value => {
              const selected = value === myVote;
              return (
                <button
                  key={value}
                  onClick={() => onSelect(value)}
                  disabled={isRevealed}
                  style={selected ? {
                    width: 42, height: 58, borderRadius: 8, background: 'var(--sp-accent-panel)', border: '2px solid var(--sp-accent)',
                    boxShadow: '0 0 0 3px oklch(0.62 0.19 265 / 0.18)', color: 'oklch(0.95 0.01 265)', fontFamily: 'var(--sp-mono)',
                    fontSize: 16, fontWeight: 700, cursor: 'pointer', transform: 'translateY(-6px)', transition: 'transform 0.15s ease',
                  } : {
                    width: 42, height: 58, borderRadius: 8, background: 'oklch(0.19 0.012 260)', border: '1.5px solid var(--sp-border-strong)',
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
