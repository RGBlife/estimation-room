import { useEffect, useState } from 'react';
import { AvatarBuilder, useAvatarPanelWidth } from '../avatar/index.js';
import ThemeToggle from '../../shared/ui/ThemeToggle.jsx';
import { randomRoomCode } from './roomCode.js';
import { loadProfile, saveProfile } from './profile.js';
import { randomAvatar } from '../avatar/avatar.js';

export default function JoinScreen({ onJoin, onCreate, joinError, notice, prefillRoomCode, ready, theme, onToggleTheme }) {
  const [storedProfile] = useState(loadProfile);
  const [avatar, setAvatar] = useState(() => storedProfile?.avatar ?? randomAvatar());
  const [name, setName] = useState(() => storedProfile?.name ?? '');
  const [mode, setMode] = useState('join');
  const [role, setRole] = useState('participant');
  const [roomCodeInput, setRoomCodeInput] = useState(prefillRoomCode ?? '');
  const [busy, setBusy] = useState(false);
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const panelWidth = useAvatarPanelWidth(avatarExpanded);
  const cardMaxWidth = panelWidth ? panelWidth + 56 : 460;

  // Persist as the user customizes, not just on join, so the look/name
  // survives closing the tab even if they never actually joined a room.
  useEffect(() => {
    saveProfile({ name: name.trim().slice(0, 40), avatar });
  }, [name, avatar]);

  const switchToCreate = () => { setMode('create'); setRoomCodeInput(randomRoomCode()); };
  const switchToJoin = () => { setMode('join'); setRoomCodeInput(''); };

  const handleRoomCodeChange = (e) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setRoomCodeInput(v);
  };

  const joinDisabled = !name.trim() || !roomCodeInput || busy || !ready;

  const handleSubmit = async () => {
    if (joinDisabled) return;
    setBusy(true);
    const trimmedName = name.trim().slice(0, 40);
    const payload = { name: trimmedName, avatar, isObserver: role === 'observer' };
    try {
      await (mode === 'create' ? onCreate(payload) : onJoin(roomCodeInput, payload));
    } finally {
      setBusy(false);
    }
  };

  // Enter submits whichever mode is active (join or create), from either text
  // field. Not a <form> — the avatar customizer's own buttons live in this
  // same card and would otherwise trigger a submit on click.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.target.tagName === 'INPUT')) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: '100%', maxWidth: cardMaxWidth, animation: 'sp-fade-in 0.4s ease', transition: 'max-width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--sp-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sp-mono)', fontWeight: 700, fontSize: 13, color: 'var(--sp-bg)' }}>ER</div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Estimation Room</span>
        </div>

        <div onKeyDown={handleKeyDown} style={{ background: 'var(--sp-panel)', border: '1px solid var(--sp-border)', borderRadius: 14, padding: 28 }}>

          <AvatarBuilder avatar={avatar} onChange={setAvatar} onExpandedChange={setAvatarExpanded} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sp-text-faint)', marginBottom: 6, fontWeight: 600 }}>Your name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sam Rivera"
                maxLength={40}
                style={{ width: '100%', background: 'var(--sp-bg)', border: '1px solid var(--sp-border)', borderRadius: 8, padding: '11px 12px', color: 'var(--sp-text)', fontFamily: 'var(--sp-font)', fontSize: 14, outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sp-text-faint)', marginBottom: 6, fontWeight: 600 }}>Your role this round</label>
              <div style={{ position: 'relative', display: 'flex', background: 'var(--sp-bg)', border: '1px solid var(--sp-border)', borderRadius: 8, padding: 3 }}>
                <div
                  style={{
                    position: 'absolute', top: 3, bottom: 3, left: 3,
                    width: 'calc(50% - 3px)', borderRadius: 6, background: 'var(--sp-accent)',
                    transform: role === 'observer' ? 'translateX(100%)' : 'translateX(0)',
                    transition: 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  }}
                />
                <button
                  onClick={() => setRole('participant')}
                  style={{ position: 'relative', flex: 1, background: 'none', border: 'none', borderRadius: 6, padding: 8, color: role === 'participant' ? 'var(--sp-bg)' : 'var(--sp-text-dimmer)', fontSize: 13, fontWeight: role === 'participant' ? 700 : 600, cursor: 'pointer', fontFamily: 'var(--sp-font)', transition: 'color 0.15s ease' }}
                >Participant</button>
                <button
                  onClick={() => setRole('observer')}
                  style={{ position: 'relative', flex: 1, background: 'none', border: 'none', borderRadius: 6, padding: 8, color: role === 'observer' ? 'var(--sp-bg)' : 'var(--sp-text-dimmer)', fontSize: 13, fontWeight: role === 'observer' ? 700 : 600, cursor: 'pointer', fontFamily: 'var(--sp-font)', transition: 'color 0.15s ease' }}
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
                  placeholder="Enter your room code"
                  maxLength={6}
                  style={{ width: '100%', background: 'var(--sp-bg)', border: '1px solid var(--sp-border)', borderRadius: 8, padding: '11px 12px', color: 'var(--sp-text)', fontFamily: roomCodeInput ? 'var(--sp-mono)' : 'var(--sp-font)', fontSize: 14, letterSpacing: roomCodeInput ? '0.1em' : 'normal', outline: 'none', textTransform: roomCodeInput ? 'uppercase' : 'none' }}
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={joinDisabled}
              style={{ width: '100%', background: 'var(--sp-accent)', border: 'none', borderRadius: 8, padding: 12, color: 'var(--sp-bg)', fontFamily: 'var(--sp-font)', fontSize: 14, fontWeight: 700, cursor: joinDisabled ? 'default' : 'pointer', marginTop: 6, opacity: joinDisabled ? 0.6 : 1 }}
            >{busy ? 'Please wait…' : !ready ? 'Connecting…' : (mode === 'create' ? 'Create room' : 'Join room')}</button>

            {mode === 'join' ? (
              <button onClick={switchToCreate} style={{ background: 'none', border: 'none', color: 'var(--sp-text-faint)', fontSize: 13, cursor: 'pointer', textAlign: 'center', padding: 2 }}>or create a new room</button>
            ) : (
              <button onClick={switchToJoin} style={{ background: 'none', border: 'none', color: 'var(--sp-text-faint)', fontSize: 13, cursor: 'pointer', textAlign: 'center', padding: 2 }}>or join an existing room</button>
            )}

            {joinError && (
              <div style={{ color: 'var(--sp-warn-text)', fontSize: 13, textAlign: 'center' }}>{joinError}</div>
            )}

            {!joinError && notice && (
              <div style={{ color: 'var(--sp-text-faint)', fontSize: 13, textAlign: 'center' }}>{notice}</div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--sp-text-placeholder)' }}>No account needed — just enter a name</div>
      </div>
    </div>
  );
}
