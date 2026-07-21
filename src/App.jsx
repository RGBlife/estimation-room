import { useState } from 'react';
import JoinScreen from './screens/JoinScreen.jsx';
import RoomScreen from './screens/RoomScreen.jsx';
import { useRoom } from './lib/useRoom.js';

export default function App() {
  const { uid, room, roomCode, error, createRoom, joinRoom, setRole, castVote, setStory, reveal, startNextRound, leave } = useRoom();
  const [joinError, setJoinError] = useState(null);

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

  return (
    <div className="sp-app">
      {!room ? (
        <JoinScreen onJoin={handleJoin} onCreate={handleCreate} joinError={joinError || error} />
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
