import { useEffect, useRef, useState } from 'react';
import { JoinScreen, loadProfile, loadLastRoomCode } from '../features/join/index.js';
import type { JoinPayload } from '../features/join/JoinScreen.tsx';
import { RoomScreen } from '../features/room/index.js';
import { useRoomStore } from '../features/room/roomStore.ts';
import { DEFAULT_DECK } from '../features/room/decks.ts';
import { loadTheme, saveTheme, type Theme } from '../shared/lib/theme.ts';

function roomCodeFromUrl(): string | null {
  const code = new URLSearchParams(window.location.search).get('room');
  return code ? code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : null;
}

// A profile with no name yet (e.g. someone who loaded the join screen but
// never typed one) can't join a room — Firestore rules require a non-empty
// name. Auto-join must fall back to the form rather than attempt that write.
function usableProfile() {
  const profile = loadProfile();
  return profile?.name?.trim() ? profile : null;
}

export default function App() {
  const uid = useRoomStore(s => s.uid);
  const room = useRoomStore(s => s.room);
  const roomCode = useRoomStore(s => s.roomCode);
  const error = useRoomStore(s => s.error);
  const notice = useRoomStore(s => s.notice);
  const throws = useRoomStore(s => s.throws);
  const createRoom = useRoomStore(s => s.createRoom);
  const joinRoom = useRoomStore(s => s.joinRoom);
  const setRole = useRoomStore(s => s.setRole);
  const castVote = useRoomStore(s => s.castVote);
  const setStory = useRoomStore(s => s.setStory);
  const setDeck = useRoomStore(s => s.setDeck);
  const reveal = useRoomStore(s => s.reveal);
  const startNextRound = useRoomStore(s => s.startNextRound);
  const leave = useRoomStore(s => s.leave);
  const throwWeapon = useRoomStore(s => s.throwWeapon);
  const dismissThrow = useRoomStore(s => s.dismissThrow);

  useEffect(() => useRoomStore.getState().initAuth(), []);

  const [joinError, setJoinError] = useState<string | null>(null);
  // Captured once at page load. Reading the URL on later renders would pick up
  // the ?room= param we put there ourselves while in a room, which made
  // leaving a room instantly auto-rejoin it. Auto-join must key off this
  // URL-only value, not the prefill fallback below, or a merely-prefilled
  // code would silently auto-join too.
  const [urlRoomCode] = useState(roomCodeFromUrl);
  // What the join form's input starts filled with: the URL param if present,
  // else the last room we were in (pure convenience — never triggers auto-join).
  const [initialRoomCode] = useState(() => urlRoomCode ?? loadLastRoomCode());
  const autoJoinAttempted = useRef(false);
  // Decided synchronously on first render so the join form never flashes
  // underneath a pending auto-join (and can't take edits that the auto-join
  // would then silently discard).
  const [autoJoining, setAutoJoining] = useState(() => !!(roomCodeFromUrl() && usableProfile()));
  // The inline script in index.html already set data-theme on <html> before
  // paint (avoiding a flash); read that back instead of recomputing it, so
  // this state and the DOM start in agreement.
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute('data-theme') as Theme) || loadTheme(),
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      return next;
    });
  };

  const handleCreate = async (payload: JoinPayload) => {
    setJoinError(null);
    try {
      await createRoom(payload);
      return true;
    } catch (e) {
      setJoinError((e as Error).message);
      return false;
    }
  };

  const handleJoin = async (code: string, payload: JoinPayload) => {
    setJoinError(null);
    try {
      await joinRoom(code, payload);
      return true;
    } catch (e) {
      setJoinError((e as Error).message);
      return false;
    }
  };

  // Auto-join is strictly a first-load behavior: once we've been in any room
  // this session, entering the join screen again always means the user wants
  // the form, not another silent join.
  useEffect(() => {
    if (room) autoJoinAttempted.current = true;
  }, [room]);

  // Arriving via a shared room link with a saved profile joins instantly,
  // skipping the join form entirely.
  useEffect(() => {
    if (!uid || !urlRoomCode || room || autoJoinAttempted.current) return;
    const profile = usableProfile();
    if (!profile) return;
    autoJoinAttempted.current = true;
    setAutoJoining(true);
    joinRoom(urlRoomCode, { name: profile.name, avatar: profile.avatar, isObserver: false, deck: DEFAULT_DECK })
      .catch((e: Error) => setJoinError(e.message))
      .finally(() => setAutoJoining(false));
  }, [uid, urlRoomCode, room, joinRoom]);

  // Keep the address bar in sync with the current room so the URL itself
  // is always a valid shareable/refreshable link, not just the copy-link button.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (roomCode) {
      url.searchParams.set('room', roomCode);
    } else {
      url.searchParams.delete('room');
    }
    if (url.toString() !== window.location.href) {
      window.history.replaceState(null, '', url);
    }
  }, [roomCode]);

  if (autoJoining && !error && !joinError) {
    return (
      <div className="sp-app items-center justify-center">
        <span className="text-sm text-sp-text-faint">Joining room…</span>
      </div>
    );
  }

  return (
    <div className="sp-app">
      {!room ? (
        <JoinScreen
          onJoin={handleJoin}
          onCreate={handleCreate}
          joinError={joinError || error}
          notice={notice}
          prefillRoomCode={initialRoomCode}
          ready={!!uid}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <RoomScreen
          room={room}
          roomCode={roomCode!}
          uid={uid}
          throws={throws}
          actions={{ setRole, castVote, setStory, setDeck, reveal, startNextRound, leave, throwWeapon, dismissThrow }}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}
