import { useState } from 'react';
import SeatTable from '../components/SeatTable.jsx';
import VotingBar from '../components/VotingBar.jsx';
import StatsBar from '../components/StatsBar.jsx';
import { computeStats } from '../lib/stats.js';

export default function RoomScreen({ room, roomCode, uid, actions }) {
  const [copied, setCopied] = useState(false);
  const me = room.participants[uid] || {};
  const isCreator = room.creatorId === uid;
  const isObserver = !!me.isObserver;
  const isRevealed = room.isRevealed;

  const { anyVote, hasAverage, average, isWideSpread } = computeStats(room.participants);

  const handleCopy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid var(--sp-border)', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--sp-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sp-mono)', fontWeight: 700, fontSize: 10, color: 'var(--sp-bg)' }}>SP</div>
          <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--sp-panel)', border: '1px solid var(--sp-border)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: 'var(--sp-text-dim)' }}>
            <span style={{ fontFamily: 'var(--sp-mono)', fontSize: 13, letterSpacing: '0.08em' }}>{roomCode}</span>
            <span style={{ fontSize: 11, color: 'var(--sp-text-faint)' }}>{copied ? 'copied' : 'copy'}</span>
          </button>

          {isCreator ? (
            <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 420 }}>
              <input
                value={room.story}
                onChange={e => actions.setStory(e.target.value)}
                placeholder="Click to add a story title or ticket ref..."
                style={{ width: '100%', background: 'transparent', border: '1px solid transparent', borderRadius: 7, padding: '6px 10px', color: 'var(--sp-text)', fontFamily: 'var(--sp-mono)', fontSize: 14, outline: 'none' }}
              />
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--sp-mono)', fontSize: 14, color: 'var(--sp-text-dim)', padding: '6px 10px' }}>{room.story || 'Untitled story'}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {!isObserver ? (
            <button onClick={() => actions.setRole(true)} style={{ background: 'var(--sp-panel-2)', border: '1px solid oklch(1 0 0 / 0.12)', borderRadius: 7, padding: '8px 12px', color: 'var(--sp-text-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Switch to observing</button>
          ) : (
            <button onClick={() => actions.setRole(false)} style={{ background: 'var(--sp-accent-panel-2)', border: '1px solid oklch(0.62 0.19 265 / 0.5)', borderRadius: 7, padding: '8px 12px', color: 'var(--sp-accent-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Switch to voting</button>
          )}
          <button onClick={actions.leave} style={{ background: 'none', border: 'none', color: 'var(--sp-text-faintest)', fontSize: 12, cursor: 'pointer' }}>Leave room</button>

          {!isRevealed ? (
            <button
              onClick={actions.reveal}
              disabled={!anyVote}
              style={{ background: 'var(--sp-accent)', border: 'none', borderRadius: 8, padding: '10px 18px', color: 'var(--sp-bg)', fontFamily: 'var(--sp-font)', fontSize: 13, fontWeight: 700, cursor: anyVote ? 'pointer' : 'default', opacity: anyVote ? 1 : 0.45 }}
            >Reveal votes</button>
          ) : (
            <button onClick={actions.startNextRound} style={{ background: 'var(--sp-accent)', border: 'none', borderRadius: 8, padding: '10px 18px', color: 'var(--sp-bg)', fontFamily: 'var(--sp-font)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Start next round</button>
          )}
        </div>
      </div>

      {isRevealed && <StatsBar hasAverage={hasAverage} average={average} isWideSpread={isWideSpread} />}

      <SeatTable participants={room.participants} uid={uid} roomCode={roomCode} isRevealed={isRevealed} />

      <VotingBar
        isObserver={isObserver}
        myVote={me.vote}
        isRevealed={isRevealed}
        onSelect={actions.castVote}
        onJoinVoting={() => actions.setRole(false)}
      />
    </>
  );
}
