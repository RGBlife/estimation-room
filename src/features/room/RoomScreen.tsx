import { useCallback, useEffect, useRef, useState } from 'react';
import SeatTable from './SeatTable.tsx';
import VotingBar from './VotingBar.tsx';
import ThemeToggle from '../../shared/ui/ThemeToggle.tsx';
import WeaponTray from './WeaponTray.tsx';
import { computeStats, computeDistribution } from './stats.ts';
import { WEAPONS } from './weapons.ts';
import { randomAvatar, CARD_VALUES } from '../avatar/index.js';
import type { RoomDoc, Participant, CardValue } from '../../types/room.ts';
import type { ThrowEvent } from '../../types/throws.ts';
import type { Theme } from '../../shared/lib/theme.ts';

const STORY_MAX_LENGTH = 200;
const STORY_DEBOUNCE_MS = 300;
const WEAPON_TIP_MS = 10000;
const WEAPON_TIP_FADE_MS = 600;
const HAS_THROWN_KEY = 'sp_has_thrown_weapon';

// Dev-only layout testing: ?fakes=N&fakeobs=M merges N fake voters and M fake
// observers into the room client-side. Never written to Firestore, stripped
// from production builds.
const FAKE_PARTICIPANTS: Record<string, Participant> | null = (() => {
  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(window.location.search);
  const fakes = Number(params.get('fakes') || 0);
  const fakeObs = Number(params.get('fakeobs') || 0);
  if (!fakes && !fakeObs) return null;
  const out: Record<string, Participant> = {};
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

interface RoomActions {
  setRole: (isObserver: boolean) => Promise<void>;
  castVote: (value: CardValue) => Promise<void>;
  setStory: (story: string) => Promise<void>;
  reveal: () => Promise<void>;
  startNextRound: () => Promise<void>;
  leave: () => Promise<void>;
  throwWeapon: (targetUid: string, weaponId: string, offsetX?: number, offsetY?: number) => Promise<void>;
  dismissThrow: (throwId: string) => void;
}

interface RoomScreenProps {
  room: RoomDoc;
  roomCode: string;
  uid: string | null;
  throws: ThrowEvent[];
  actions: RoomActions;
  theme: Theme;
  onToggleTheme: () => void;
}

export default function RoomScreen({ room, roomCode, uid, throws, actions, theme, onToggleTheme }: RoomScreenProps) {
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [weaponTrayOpen, setWeaponTrayOpen] = useState(false);
  const [equippedWeaponId, setEquippedWeaponId] = useState<string | null>(null);
  const [weaponTipRendered, setWeaponTipRendered] = useState(false);
  const [weaponTipClosing, setWeaponTipClosing] = useState(false);
  const weaponTipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weaponTipFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredVoteValue, setHoveredVoteValue] = useState<CardValue | null>(null);
  const [votingBarHeight, setVotingBarHeight] = useState(0);
  const participants: Record<string, Participant> = FAKE_PARTICIPANTS
    ? { ...FAKE_PARTICIPANTS, ...room.participants }
    : room.participants;
  const me = participants[uid ?? ''] || ({} as Partial<Participant>);
  const isCreator = room.creatorId === uid;
  const isObserver = !!me.isObserver;
  const isRevealed = room.isRevealed;

  // uid -> DOM node, covers both active seats and the observer rail — a
  // single lookup used by ThrowOverlay to compute fly-to animation geometry.
  const seatNodesRef = useRef(new Map<string, HTMLElement>());
  const stageNodeRef = useRef<HTMLDivElement>(null);
  const registerSeatNode = useCallback((seatUid: string, node: HTMLElement | null) => {
    if (node) seatNodesRef.current.set(seatUid, node);
    else seatNodesRef.current.delete(seatUid);
  }, []);
  const getSeatNode = useCallback((seatUid: string) => seatNodesRef.current.get(seatUid) ?? null, []);
  const handleVotingBarHeightChange = useCallback((h: number) => setVotingBarHeight(h), []);

  // The story input is edited locally and written to Firestore debounced, so
  // we don't do one write per keystroke and the snapshot echo can't fight the
  // creator's in-progress typing.
  const [storyDraft, setStoryDraft] = useState(room.story);
  const storyInputRef = useRef<HTMLInputElement>(null);
  const storyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (document.activeElement !== storyInputRef.current) setStoryDraft(room.story);
  }, [room.story]);
  useEffect(() => () => clearTimeout(storyTimerRef.current ?? undefined), []);

  const { anyVote, allVoted, hasAverage, average, isWideSpread } = computeStats(participants);
  const distribution = isRevealed ? computeDistribution(participants) : [];
  // Seats only dim while actively hovering a bar in the distribution panel —
  // no highlight is shown by default, so the table stays at full brightness
  // until the user is inspecting a specific vote group.
  const highlightValues = hoveredVoteValue != null ? [hoveredVoteValue] : [];
  useEffect(() => {
    if (!isRevealed) setHoveredVoteValue(null);
  }, [isRevealed]);

  const runAction = (fn: () => Promise<void>, failureMessage: string) => {
    setActionError(null);
    fn().catch(() => setActionError(failureMessage));
  };

  const handleCastVote = (value: CardValue) => {
    runAction(() => actions.castVote(value), "Your vote didn't save — check your connection and try again.");
  };

  const handleReveal = () => {
    runAction(actions.reveal, "Couldn't reveal votes — try again.");
  };

  const handleStartNextRound = () => {
    runAction(actions.startNextRound, "Couldn't start the next round — try again.");
  };

  // Enter triggers whichever of the two round-progression actions is
  // currently available, and the number row casts a vote by position (1 is
  // the 1st card, 2 the 2nd, ... 0 the 10th) — keyed off CARD_VALUES' order
  // rather than its contents, so this keeps working if the cards ever become
  // customizable and stop being plain 0/1/2/3/5/8/13/20/?/☕. Both ignored
  // while typing (story title input) so they don't hijack normal text entry.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        if (!isRevealed && allVoted && anyVote) {
          e.preventDefault();
          handleReveal();
        } else if (isRevealed) {
          e.preventDefault();
          handleStartNextRound();
        }
        return;
      }
      if (!isRevealed && !isObserver && /^[0-9]$/.test(e.key)) {
        const cardIdx = (Number(e.key) + 9) % 10; // '1'->0, '2'->1, ..., '9'->8, '0'->9
        const value = CARD_VALUES[cardIdx];
        if (value != null) {
          e.preventDefault();
          handleCastVote(value);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRevealed, allVoted, anyVote, isObserver]);

  // The "click someone to hit them" banner is a one-time tip: it only shows
  // the first time this browser ever equips a weapon, and auto-fades after
  // WEAPON_TIP_MS. Once the user has actually thrown once, it never shows
  // again (tracked in localStorage so it stays gone across sessions/rounds).
  const dismissWeaponTip = () => {
    clearTimeout(weaponTipTimerRef.current ?? undefined);
    setWeaponTipClosing(true);
    clearTimeout(weaponTipFadeTimerRef.current ?? undefined);
    weaponTipFadeTimerRef.current = setTimeout(() => {
      setWeaponTipRendered(false);
      setWeaponTipClosing(false);
    }, WEAPON_TIP_FADE_MS);
  };

  const handleSelectWeapon = (weaponId: string) => {
    setEquippedWeaponId(weaponId);
    setWeaponTrayOpen(false);
    clearTimeout(weaponTipTimerRef.current ?? undefined);
    if (!localStorage.getItem(HAS_THROWN_KEY)) {
      clearTimeout(weaponTipFadeTimerRef.current ?? undefined);
      setWeaponTipRendered(true);
      setWeaponTipClosing(false);
      weaponTipTimerRef.current = setTimeout(dismissWeaponTip, WEAPON_TIP_MS);
    }
  };

  const handleCancelTargeting = () => {
    setEquippedWeaponId(null);
    dismissWeaponTip();
  };

  useEffect(() => () => {
    clearTimeout(weaponTipTimerRef.current ?? undefined);
    clearTimeout(weaponTipFadeTimerRef.current ?? undefined);
  }, []);

  // Weapon stays equipped after a throw so people can keep hitting targets
  // without reopening the tray — only Cancel or picking a new weapon clears it.
  // The click position within the target's avatar (roughly -0.5..0.5 of its
  // width/height, from center) travels with the throw so the impact lands
  // where they actually clicked instead of always snapping to the center.
  const handleThrowAt = (targetUid: string, event?: React.MouseEvent) => {
    if (!equippedWeaponId) return;
    let offsetX = 0;
    let offsetY = 0;
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      offsetX = (event.clientX - rect.left) / rect.width - 0.5;
      offsetY = (event.clientY - rect.top) / rect.height - 0.5;
    }
    localStorage.setItem(HAS_THROWN_KEY, '1');
    dismissWeaponTip();
    runAction(() => actions.throwWeapon(targetUid, equippedWeaponId, offsetX, offsetY), "Couldn't throw — check your connection.");
  };

  const handleStoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, STORY_MAX_LENGTH);
    setStoryDraft(value);
    clearTimeout(storyTimerRef.current ?? undefined);
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
            equippedWeaponId ? (
              <button onClick={handleCancelTargeting} style={{ border: '1px solid var(--sp-accent-border)', background: 'var(--sp-accent-panel-2)', color: 'var(--sp-accent-text)', fontWeight: 700, fontFamily: 'var(--sp-font)', padding: '9px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                Cancel throwing {WEAPONS.find(w => w.id === equippedWeaponId)?.label}
              </button>
            ) : (
              <button onClick={() => setWeaponTrayOpen(true)} style={{ border: 'none', background: 'var(--sp-accent)', color: 'var(--sp-bg)', fontWeight: 700, fontFamily: 'var(--sp-font)', padding: '9px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>🎯 Choose Your Weapon</button>
            )
          )}
          {!isObserver ? (
            <button onClick={() => runAction(() => actions.setRole(true), "Couldn't switch role — check your connection.")} style={{ background: 'var(--sp-panel-2)', border: '1px solid var(--sp-border-strong)', borderRadius: 7, padding: '8px 12px', color: 'var(--sp-text-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Switch to observing</button>
          ) : (
            <button onClick={() => runAction(() => actions.setRole(false), "Couldn't switch role — check your connection.")} style={{ background: 'var(--sp-accent-panel-2)', border: '1px solid var(--sp-accent-border)', borderRadius: 7, padding: '8px 12px', color: 'var(--sp-accent-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}>Switch to voting</button>
          )}
          <button onClick={actions.leave} style={{ background: 'none', border: 'none', color: 'var(--sp-text-faintest)', fontSize: 12, cursor: 'pointer' }}>Leave room</button>
        </div>
      </div>

      {equippedWeaponId && weaponTipRendered && (
        <div
          style={{
            position: 'fixed', top: 72, left: '50%', zIndex: 40,
            background: 'var(--sp-accent-panel-2-transparent)', backdropFilter: 'blur(6px)',
            border: '1px solid var(--sp-accent-border)', borderRadius: 10, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
            fontWeight: 700, fontSize: 13, color: 'var(--sp-accent-text)', whiteSpace: 'nowrap',
            animation: `${weaponTipClosing ? 'sp-tip-fade-out' : 'sp-tip-fade-in'} ${WEAPON_TIP_FADE_MS}ms ease both`,
          }}
        >
          <span>🎯 Throwing {WEAPONS.find(w => w.id === equippedWeaponId)?.label} — click someone to hit them</span>
          <button onClick={dismissWeaponTip} style={{ border: 'none', background: 'none', fontWeight: 800, color: 'var(--sp-accent-text)', cursor: 'pointer', fontSize: 13 }}>Close</button>
        </div>
      )}

      <WeaponTray open={weaponTrayOpen} selectedWeaponId={equippedWeaponId} onSelect={handleSelectWeapon} onClose={() => setWeaponTrayOpen(false)} />

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
        highlightValues={highlightValues}
        bottomClearance={votingBarHeight}
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
        hoveredValue={hoveredVoteValue}
        onHoverValue={setHoveredVoteValue}
        onHeightChange={handleVotingBarHeightChange}
      />
    </>
  );
}
