import { useState } from 'react';
import AvatarBuilder, { makeAvatarUrl } from '../components/AvatarBuilder.jsx';
import { randomRoomCode } from '../lib/roomCode.js';
import { loadProfile, saveProfile } from '../lib/profile.js';

const randomAvatar = () => ({
  seed: Math.random().toString(36).slice(2, 10),
  bgIdx: Math.floor(Math.random() * 8),
  glasses: false,
  earrings: false,
  flair: false,
});

export default function JoinScreen({ onJoin, onCreate, joinError, prefillRoomCode }) {
  const storedProfile = loadProfile();
  const [avatar, setAvatar] = useState(() => storedProfile?.avatar ?? randomAvatar());
  const [name, setName] = useState(() => storedProfile?.name ?? '');
  const [mode, setMode] = useState('join');
  const [role, setRole] = useState('participant');
  const [roomCodeInput, setRoomCodeInput] = useState(prefillRoomCode ?? '');
  const [busy, setBusy] = useState(false);

  const switchToCreate = () => { setMode('create'); setRoomCodeInput(randomRoomCode()); };
  const switchToJoin = () => { setMode('join'); setRoomCodeInput(''); };

  const handleRoomCodeChange = (e) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setRoomCodeInput(v);
  };

  const joinDisabled = !name.trim() || !roomCodeInput || busy;

  const handleSubmit = async () => {
    if (joinDisabled) return;
    setBusy(true);
    const avatarUrl = makeAvatarUrl(avatar);
    const trimmedName = name.trim();
    const payload = { name: trimmedName, avatarUrl, isObserver: role === 'observer' };
    try {
      if (mode === 'create') {
        await onCreate(payload);
      } else {
        await onJoin(roomCodeInput, payload);
      }
      saveProfile({ name: trimmedName, avatar });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: '100%', maxWidth: 460, animation: 'sp-fade-in 0.4s ease' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--sp-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sp-mono)', fontWeight: 700, fontSize: 13, color: 'var(--sp-bg)' }}>ER</div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Estimation Room</span>
        </div>

        <div style={{ background: 'var(--sp-panel)', border: '1px solid var(--sp-border)', borderRadius: 14, padding: 28 }}>

          <AvatarBuilder avatar={avatar} onChange={setAvatar} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sp-text-faint)', marginBottom: 6, fontWeight: 600 }}>Your name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sam Rivera"
                style={{ width: '100%', background: 'var(--sp-bg)', border: '1px solid var(--sp-border)', borderRadius: 8, padding: '11px 12px', color: 'var(--sp-text)', fontFamily: 'var(--sp-font)', fontSize: 14, outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sp-text-faint)', marginBottom: 6, fontWeight: 600 }}>Your role this round</label>
              <div style={{ display: 'flex', background: 'var(--sp-bg)', border: '1px solid var(--sp-border)', borderRadius: 8, padding: 3 }}>
                <button
                  onClick={() => setRole('participant')}
                  style={{ flex: 1, background: role === 'participant' ? 'var(--sp-accent)' : 'none', border: 'none', borderRadius: 6, padding: 8, color: role === 'participant' ? 'var(--sp-bg)' : 'var(--sp-text-dimmer)', fontSize: 13, fontWeight: role === 'participant' ? 700 : 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}
                >Participant</button>
                <button
                  onClick={() => setRole('observer')}
                  style={{ flex: 1, background: role === 'observer' ? 'var(--sp-accent)' : 'none', border: 'none', borderRadius: 6, padding: 8, color: role === 'observer' ? 'var(--sp-bg)' : 'var(--sp-text-dimmer)', fontSize: 13, fontWeight: role === 'observer' ? 700 : 600, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}
                >Observer</button>
              </div>
            </div>

            {mode === 'create' ? (
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--sp-text-faint)', marginBottom: 6, fontWeight: 600 }}>Room code</label>
                <div style={{ width: '100%', background: 'var(--sp-bg)', border: '1px solid var(--sp-border)', borderRadius: 8, padding: '11px 12px', fontFamily: 'var(--sp-mono)', fontSize: 14, letterSpacing: '0.1em', color: 'var(--sp-accent-text)' }}>
                  {roomCodeInput} <span style={{ color: 'var(--sp-text-placeholder)', fontFamily: 'var(--sp-font)', letterSpacing: 0, fontSize: 12 }}>— new room</span>
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--sp-text-faint)', marginBottom: 6, fontWeight: 600 }}>Room code</label>
                <input
                  value={roomCodeInput}
                  onChange={handleRoomCodeChange}
                  placeholder="ABCD"
                  maxLength={6}
                  style={{ width: '100%', background: 'var(--sp-bg)', border: '1px solid var(--sp-border)', borderRadius: 8, padding: '11px 12px', color: 'var(--sp-text)', fontFamily: 'var(--sp-mono)', fontSize: 14, letterSpacing: '0.1em', outline: 'none', textTransform: 'uppercase' }}
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={joinDisabled}
              style={{ width: '100%', background: 'var(--sp-accent)', border: 'none', borderRadius: 8, padding: 12, color: 'var(--sp-bg)', fontFamily: 'var(--sp-font)', fontSize: 14, fontWeight: 700, cursor: joinDisabled ? 'default' : 'pointer', marginTop: 6, opacity: joinDisabled ? 0.6 : 1 }}
            >{busy ? 'Please wait…' : (mode === 'create' ? 'Create room' : 'Join room')}</button>

            {mode === 'join' ? (
              <button onClick={switchToCreate} style={{ background: 'none', border: 'none', color: 'var(--sp-text-faint)', fontSize: 13, cursor: 'pointer', textAlign: 'center', padding: 2 }}>or create a new room</button>
            ) : (
              <button onClick={switchToJoin} style={{ background: 'none', border: 'none', color: 'var(--sp-text-faint)', fontSize: 13, cursor: 'pointer', textAlign: 'center', padding: 2 }}>or join an existing room</button>
            )}

            {joinError && (
              <div style={{ color: 'var(--sp-warn-text)', fontSize: 13, textAlign: 'center' }}>{joinError}</div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--sp-text-placeholder)' }}>No account needed — just enter a name</div>
      </div>
    </div>
  );
}
