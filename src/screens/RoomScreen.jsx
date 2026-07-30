import { useEffect, useRef, useState } from 'react';
import SeatTable from '../components/SeatTable.jsx';
import VotingBar from '../components/VotingBar.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { computeStats, computeDistribution } from '../lib/stats.js';

const STORY_MAX_LENGTH = 200;
const STORY_DEBOUNCE_MS = 300;

export default function RoomScreen({ room, roomCode, uid, actions, theme, onToggleTheme }) {
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState(null);
  const me = room.participants[uid] || {};
  const isCreator = room.creatorId === uid;
  const isObserver = !!me.isObserver;
  const isRevealed = room.isRevealed;

  // The story input is edited locally and written to Firestore debounced, so
  // we don't do one write per keystroke and the snapshot echo can't fight the
  // creator's in-progress typing.
  const [storyDraft, setStoryDraft] = useState(room.story);
  const storyInputRef = useRef(null);
  const storyTimerRef = useRef(null);
  useEffect(() => {
    if (document.activeElement !== storyInputRef.current) setStoryDraft(room.story);
  }, [room.story]);
  useEffect(() => () => clearTimeout(storyTimerRef.current), []);

  const { anyVote, allVoted, hasAverage, average, isWideSpread } = computeStats(room.participants);
  const distribution = isRevealed ? computeDistribution(room.participants) : [];

  const runAction = (fn, failureMessage) => {
    setActionError(null);
    fn().catch(() => setActionError(failureMessage));
  };

  const handleCastVote = (value) => {
    runAction(() => actions.castVote(value), "Your vote didn't save — check your connection and try again.");
  };

  const handleReveal = () => {
    runAction(actions.reveal, "Couldn't reveal votes — try again.");
  };

  const handleStartNextRound = () => {
    runAction(actions.startNextRound, "Couldn't start the next round — try again.");
  };

  const handleStoryChange = (e) => {
    const value = e.target.value.slice(0, STORY_MAX_LENGTH);
    setStoryDraft(value);
    clearTimeout(storyTimerRef.current);
    storyTimerRef.current = setTimeout(() => {
      runAction(() => actions.setStory(value), "The story title didn't save — check your connection.");
    }, STORY_DEBOUNCE_MS);
  };

  const handleCopy = () => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('room', roomCode);
    const text = url.toString();
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid var(--sp-border)', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--sp-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sp-mono)', fontWeight: 700, fontSize: 10, color: 'var(--sp-bg)' }}>ER</div>
          <button onClick={handleCopy} title="Copy shareable invite link" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--sp-panel)', border: '1px solid var(--sp-border)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: 'var(--sp-text-dim)' }}>
            <span style={{ fontFamily: 'var(--sp-mono)', fontSize: 13, letterSpacing: '0.08em' }}>{roomCode}</span>
            <span style={{ fontSize: 11, color: 'var(--sp-text-faint)' }}>{copied ? 'link copied' : 'copy link'}</span>
          </button>

          {isCreator ? (
            <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 420 }}>
              <input
                ref={storyInputRef}
                value={storyDraft}
                onChange={handleStoryChange}
                maxLength={STORY_MAX_LENGTH}
                placeholder="Click to add a story title or ticket ref..."
                style={{ width: '100%', background: 'transparent', border: '1px solid transparent', borderRadius: 7, padding: '6px 10px', color: 'var(--sp-text)', fontFamily: 'var(--sp-mono)', fontSize: 14, outline: 'none' }}
              />
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--sp-mono)', fontSize: 14, color: 'var(--sp-text-dim)', padding: '6px 10px' }}>{room.story || 'Untitled story'}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} size={34} />
          {!isObserver ? (
            <button onClick={() => runAction(() => actions.setRole(true), "Couldn't switch role — check your connection.")} style={{ background: 'var(--sp-panel-2)', border: '1px solid var(--sp-border-strong)', borderRadius: 7, padding: '8px 12px', color: 'var(--sp-text-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Switch to observing</button>
          ) : (
            <button onClick={() => runAction(() => actions.setRole(false), "Couldn't switch role — check your connection.")} style={{ background: 'var(--sp-accent-panel-2)', border: '1px solid var(--sp-accent-border)', borderRadius: 7, padding: '8px 12px', color: 'var(--sp-accent-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Switch to voting</button>
          )}
          <button onClick={actions.leave} style={{ background: 'none', border: 'none', color: 'var(--sp-text-faintest)', fontSize: 12, cursor: 'pointer' }}>Leave room</button>
        </div>
      </div>

      <SeatTable
        participants={room.participants}
        uid={uid}
        isRevealed={isRevealed}
        anyVote={anyVote}
        allVoted={allVoted}
        onReveal={handleReveal}
      />

      {actionError && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 92, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: 'var(--sp-warn-bg)', border: '1px solid var(--sp-warn-border)', color: 'var(--sp-warn-text)', padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{actionError}</div>
        </div>
      )}

      <VotingBar
        isObserver={isObserver}
        myVote={me.vote}
        isRevealed={isRevealed}
        onSelect={handleCastVote}
        onJoinVoting={() => runAction(() => actions.setRole(false), "Couldn't switch role — check your connection.")}
        distribution={distribution}
        hasAverage={hasAverage}
        average={average}
        isWideSpread={isWideSpread}
        onStartNextRound={handleStartNextRound}
      />
    </>
  );
}
