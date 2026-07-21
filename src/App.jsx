import { useEffect, useRef, useState } from 'react';
import JoinScreen from './screens/JoinScreen.jsx';
import RoomScreen from './screens/RoomScreen.jsx';
import { useRoom } from './lib/useRoom.js';
import { loadProfile } from './lib/profile.js';
import { makeAvatarUrl } from './components/AvatarBuilder.jsx';

function roomCodeFromUrl() {
  const code = new URLSearchParams(window.location.search).get('room');
  return code ? code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : null;
}

export default function App() {
  const { uid, room, roomCode, error, createRoom, joinRoom, setRole, castVote, setStory, reveal, startNextRound, leave } = useRoom();
  const [joinError, setJoinError] = useState(null);
  const autoJoinAttempted = useRef(false);
  const [autoJoining, setAutoJoining] = useState(false);
  const sharedRoomCode = roomCodeFromUrl();

  const handleCreate = async (payload) => {
    setJoinError(null);
    try {
      await createRoom(payload);
    } catch (e) {
      setJoinError(e.message);
    }
  };

  const handleJoin = async (code, payload) => {
    setJoinError(null);
    try {
      await joinRoom(code, payload);
    } catch (e) {
      setJoinError(e.message);
    }
  };

  // Arriving via a shared room link with a saved profile joins instantly,
  // skipping the join form entirely.
  useEffect(() => {
    if (!uid || !sharedRoomCode || room || autoJoinAttempted.current) return;
    const profile = loadProfile();
    if (!profile) return;
    autoJoinAttempted.current = true;
    setAutoJoining(true);
    joinRoom(sharedRoomCode, { name: profile.name, avatarUrl: makeAvatarUrl(profile.avatar), isObserver: false })
      .catch(e => setJoinError(e.message))
      .finally(() => setAutoJoining(false));
  }, [uid, sharedRoomCode, room, joinRoom]);

  if (autoJoining) {
    return (
      <div className="sp-app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--sp-text-faint)', fontSize: 14 }}>Joining room…</span>
      </div>
    );
  }

  return (
    <div className="sp-app">
      {!room ? (
        <JoinScreen onJoin={handleJoin} onCreate={handleCreate} joinError={joinError || error} prefillRoomCode={sharedRoomCode} />
      ) : (
        <RoomScreen
          room={room}
          roomCode={roomCode}
          uid={uid}
          actions={{ setRole, castVote, setStory, reveal, startNextRound, leave }}
        />
      )}
    </div>
  );
}
