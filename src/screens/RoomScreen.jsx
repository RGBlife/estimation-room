import { useCallback, useEffect, useRef, useState } from 'react';
import SeatTable from '../components/SeatTable.jsx';
import VotingBar from '../components/VotingBar.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import WeaponTray from '../components/WeaponTray.jsx';
import { computeStats, computeDistribution } from '../lib/stats.js';
import { WEAPONS } from '../lib/weapons.js';
import { randomAvatar, CARD_VALUES } from '../lib/avatar.js';

const STORY_MAX_LENGTH = 200;
const STORY_DEBOUNCE_MS = 300;

// Dev-only layout testing: ?fakes=N&fakeobs=M merges N fake voters and M fake
// observers into the room client-side. Never written to Firestore, stripped
// from production builds.
const FAKE_PARTICIPANTS = (() => {
  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(window.location.search);
  const fakes = Number(params.get('fakes') || 0);
  const fakeObs = Number(params.get('fakeobs') || 0);
  if (!fakes && !fakeObs) return null;
  const out = {};
  for (let i = 0; i < fakes + fakeObs; i++) {
    out[`fake-${i}`] = {
      name: `Player ${i + 1}`,
      avatar: randomAvatar(),
      joinedAt: 1e12 + i,
      isObserver: i >= fakes,
      vote: i < fakes ? CARD_VALUES[i % 8] : null,
    };
  }
  return out;
})();

export default function RoomScreen({ room, roomCode, uid, throws, actions, theme, onToggleTheme }) {
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [weaponTrayOpen, setWeaponTrayOpen] = useState(false);
  const [equippedWeaponId, setEquippedWeaponId] = useState(null);
  const participants = FAKE_PARTICIPANTS ? { ...FAKE_PARTICIPANTS, ...room.participants } : room.participants;
  const me = participants[uid] || {};
  const isCreator = room.creatorId === uid;
  const isObserver = !!me.isObserver;
  const isRevealed = room.isRevealed;

  // uid -> DOM node, covers both active seats and the observer rail — a
  // single lookup used by ThrowOverlay to compute fly-to animation geometry.
  const seatNodesRef = useRef(new Map());
  const stageNodeRef = useRef(null);
  const registerSeatNode = useCallback((seatUid, node) => {
    if (node) seatNodesRef.current.set(seatUid, node);
    else seatNodesRef.current.delete(seatUid);
  }, []);
  const getSeatNode = useCallback((seatUid) => seatNodesRef.current.get(seatUid) ?? null, []);

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

  const { anyVote, allVoted, hasAverage, average, isWideSpread } = computeStats(participants);
  const distribution = isRevealed ? computeDistribution(participants) : [];

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

  const handleSelectWeapon = (weaponId) => {
    setEquippedWeaponId(weaponId);
    setWeaponTrayOpen(false);
  };

  const handleCancelTargeting = () => setEquippedWeaponId(null);

  // Weapon stays equipped after a throw so people can keep hitting targets
  // without reopening the tray — only Cancel or picking a new weapon clears it.
  // The click position within the target's avatar (roughly -0.5..0.5 of its
  // width/height, from center) travels with the throw so the impact lands
  // where they actually clicked instead of always snapping to the center.
  const handleThrowAt = (targetUid, event) => {
    if (!equippedWeaponId) return;
    let offsetX = 0;
    let offsetY = 0;
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      offsetX = (event.clientX - rect.left) / rect.width - 0.5;
      offsetY = (event.clientY - rect.top) / rect.height - 0.5;
    }
    runAction(() => actions.throwWeapon(targetUid, equippedWeaponId, offsetX, offsetY), "Couldn't throw — check your connection.");
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} size={34} />
          {!isObserver && (
            <button onClick={() => setWeaponTrayOpen(true)} style={{ border: 'none', background: 'var(--sp-accent)', color: 'var(--sp-bg)', fontWeight: 700, fontFamily: 'var(--sp-font)', padding: '9px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>🎯 Choose Your Weapon</button>
          )}
          {!isObserver ? (
            <button onClick={() => runAction(() => actions.setRole(true), "Couldn't switch role — check your connection.")} style={{ background: 'var(--sp-panel-2)', border: '1px solid var(--sp-border-strong)', borderRadius: 7, padding: '8px 12px', color: 'var(--sp-text-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Switch to observing</button>
          ) : (
            <button onClick={() => runAction(() => actions.setRole(false), "Couldn't switch role — check your connection.")} style={{ background: 'var(--sp-accent-panel-2)', border: '1px solid var(--sp-accent-border)', borderRadius: 7, padding: '8px 12px', color: 'var(--sp-accent-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Switch to voting</button>
          )}
          <button onClick={actions.leave} style={{ background: 'none', border: 'none', color: 'var(--sp-text-faintest)', fontSize: 12, cursor: 'pointer' }}>Leave room</button>
        </div>
      </div>

      {equippedWeaponId && (
        <div style={{ margin: '0 28px 10px', background: 'var(--sp-accent-panel-2)', border: '1px solid var(--sp-accent-border)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontWeight: 700, color: 'var(--sp-accent-text)', flexWrap: 'wrap' }}>
          <span>🎯 Throwing {WEAPONS.find(w => w.id === equippedWeaponId)?.label} — click someone to hit them</span>
          <button onClick={handleCancelTargeting} style={{ border: 'none', background: 'none', fontWeight: 800, color: 'var(--sp-accent-text)', cursor: 'pointer', fontSize: 15 }}>✕ Cancel</button>
        </div>
      )}

      {weaponTrayOpen && (
        <WeaponTray selectedWeaponId={equippedWeaponId} onSelect={handleSelectWeapon} onClose={() => setWeaponTrayOpen(false)} />
      )}

      <SeatTable
        participants={participants}
        uid={uid}
        isRevealed={isRevealed}
        anyVote={anyVote}
        allVoted={allVoted}
        onReveal={handleReveal}
        canTarget={!!equippedWeaponId}
        onThrowAt={handleThrowAt}
        registerSeatNode={registerSeatNode}
        getSeatNode={getSeatNode}
        stageRef={stageNodeRef}
        throws={throws}
        onThrowDone={actions.dismissThrow}
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
