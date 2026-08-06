import { useEffect, useRef, useState } from 'react';
import { JoinScreen, loadProfile, loadLastRoomCode } from '../features/join/index.js';
import type { JoinPayload } from '../features/join/JoinScreen.tsx';
import { RoomScreen, useRoom } from '../features/room/index.js';
import { loadTheme, saveTheme, type Theme } from '../shared/lib/theme.ts';
import type { RoomDoc } from '../types/room.ts';
import type { ThrowEvent } from '../types/throws.ts';

// useRoom.js is not yet converted to TypeScript -- it becomes the Zustand
// store in the next restructure stage, so typing it now would be thrown
// away almost immediately. This interface describes its return shape as a
// stopgap until then.
interface UseRoomResult {
  uid: string | null;
  room: RoomDoc | null;
  roomCode: string | null;
  error: string | null;
  notice: string | null;
  throws: ThrowEvent[];
  createRoom: (payload: JoinPayload) => Promise<string>;
  joinRoom: (code: string, payload: JoinPayload) => Promise<void>;
  setRole: (isObserver: boolean) => Promise<void>;
  castVote: (value: string) => Promise<void>;
  setStory: (story: string) => Promise<void>;
  reveal: () => Promise<void>;
  startNextRound: () => Promise<void>;
  leave: () => Promise<void>;
  throwWeapon: (targetUid: string, weaponId: string, offsetX?: number, offsetY?: number) => Promise<void>;
  dismissThrow: (throwId: string) => void;
}

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
  const {
    uid, room, roomCode, error, notice, throws,
    createRoom, joinRoom, setRole, castVote, setStory, reveal, startNextRound, leave,
    throwWeapon, dismissThrow,
  } = useRoom() as UseRoomResult;
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
    joinRoom(urlRoomCode, { name: profile.name, avatar: profile.avatar, isObserver: false })
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
      <div className="sp-app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--sp-text-faint)', fontSize: 14 }}>Joining room…</span>
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
          actions={{ setRole, castVote, setStory, reveal, startNextRound, leave, throwWeapon, dismissThrow }}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}
