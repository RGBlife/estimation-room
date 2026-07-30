import { useEffect, useRef, useState } from 'react';
import JoinScreen from './screens/JoinScreen.jsx';
import RoomScreen from './screens/RoomScreen.jsx';
import { useRoom } from './lib/useRoom.js';
import { loadProfile } from './lib/profile.js';
import { loadTheme, saveTheme } from './lib/theme.js';

function roomCodeFromUrl() {
  const code = new URLSearchParams(window.location.search).get('room');
  return code ? code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : null;
}

export default function App() {
  const { uid, room, roomCode, error, notice, createRoom, joinRoom, setRole, castVote, setStory, reveal, startNextRound, leave } = useRoom();
  const [joinError, setJoinError] = useState(null);
  // Captured once at page load. Reading the URL on later renders would pick up
  // the ?room= param we put there ourselves while in a room, which made
  // leaving a room instantly auto-rejoin it.
  const [initialRoomCode] = useState(roomCodeFromUrl);
  const autoJoinAttempted = useRef(false);
  // Decided synchronously on first render so the join form never flashes
  // underneath a pending auto-join (and can't take edits that the auto-join
  // would then silently discard).
  const [autoJoining, setAutoJoining] = useState(() => !!(roomCodeFromUrl() && loadProfile()));
  // The inline script in index.html already set data-theme on <html> before
  // paint (avoiding a flash); read that back instead of recomputing it, so
  // this state and the DOM start in agreement.
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || loadTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      return next;
    });
  };

  const handleCreate = async (payload) => {
    setJoinError(null);
    try {
      await createRoom(payload);
      return true;
    } catch (e) {
      setJoinError(e.message);
      return false;
    }
  };

  const handleJoin = async (code, payload) => {
    setJoinError(null);
    try {
      await joinRoom(code, payload);
      return true;
    } catch (e) {
      setJoinError(e.message);
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
    if (!uid || !initialRoomCode || room || autoJoinAttempted.current) return;
    const profile = loadProfile();
    if (!profile) return;
    autoJoinAttempted.current = true;
    setAutoJoining(true);
    joinRoom(initialRoomCode, { name: profile.name, avatar: profile.avatar, isObserver: false })
      .catch(e => setJoinError(e.message))
      .finally(() => setAutoJoining(false));
  }, [uid, initialRoomCode, room, joinRoom]);

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
          roomCode={roomCode}
          uid={uid}
          actions={{ setRole, castVote, setStory, reveal, startNextRound, leave }}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}
