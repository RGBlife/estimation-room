import { useEffect, useState } from 'react';
import { AvatarBuilder, useAvatarPanelWidth } from '../avatar/index.js';
import ThemeToggle from '../../shared/ui/ThemeToggle.tsx';
import { randomRoomCode } from './roomCode.ts';
import { loadProfile, saveProfile } from './profile.ts';
import { randomAvatar } from '../avatar/avatar.ts';
import { DECKS, DECK_ORDER, DEFAULT_DECK } from '../room/decks.ts';
import type { AvatarOptions, DeckId } from '../../types/room.ts';
import type { Theme } from '../../shared/lib/theme.ts';

export interface JoinPayload {
  name: string;
  avatar: AvatarOptions;
  isObserver: boolean;
  deck: DeckId;
}

interface JoinScreenProps {
  onJoin: (code: string, payload: JoinPayload) => Promise<boolean>;
  onCreate: (payload: JoinPayload) => Promise<boolean>;
  joinError: string | null;
  notice: string | null;
  prefillRoomCode: string | null;
  ready: boolean;
  theme: Theme;
  onToggleTheme: () => void;
}

export default function JoinScreen({ onJoin, onCreate, joinError, notice, prefillRoomCode, ready, theme, onToggleTheme }: JoinScreenProps) {
  const [storedProfile] = useState(loadProfile);
  const [avatar, setAvatar] = useState(() => storedProfile?.avatar ?? randomAvatar());
  const [name, setName] = useState(() => storedProfile?.name ?? '');
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [role, setRole] = useState<'participant' | 'observer'>('participant');
  const [deck, setDeck] = useState<DeckId>(DEFAULT_DECK);
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

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setRoomCodeInput(v);
  };

  const joinDisabled = !name.trim() || !roomCodeInput || busy || !ready;

  const handleSubmit = async () => {
    if (joinDisabled) return;
    setBusy(true);
    const trimmedName = name.trim().slice(0, 40);
    const payload = { name: trimmedName, avatar, isObserver: role === 'observer', deck };
    try {
      await (mode === 'create' ? onCreate(payload) : onJoin(roomCodeInput, payload));
    } finally {
      setBusy(false);
    }
  };

  // Enter submits whichever mode is active (join or create), from either text
  // field. Not a <form> — the avatar customizer's own buttons live in this
  // same card and would otherwise trigger a submit on click.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        className="w-full transition-[max-width] duration-[280ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{ maxWidth: cardMaxWidth, animation: 'sp-fade-in 0.4s ease' }}
      >

        <div className="mb-1.5 flex justify-end">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <div className="mb-7 flex items-center justify-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sp-accent font-sp-mono text-[13px] font-bold text-sp-bg">ER</div>
          <span className="text-lg font-bold tracking-[-0.02em]">Estimation Room</span>
        </div>

        <div onKeyDown={handleKeyDown} className="rounded-2xl border border-sp-border bg-sp-panel p-7">

          <AvatarBuilder avatar={avatar} onChange={setAvatar} onExpandedChange={setAvatarExpanded} />

          <div className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-sp-text-faint">Your name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sam Rivera"
                maxLength={40}
                className="w-full rounded-lg border border-sp-border bg-sp-bg px-3 py-2.5 font-sp-font text-sm text-sp-text outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-sp-text-faint">Your role this round</label>
              <div className="relative flex rounded-lg border border-sp-border bg-sp-bg p-[3px]">
                <div
                  className="absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-md bg-sp-accent transition-transform duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                  style={{ transform: role === 'observer' ? 'translateX(100%)' : 'translateX(0)' }}
                />
                <button
                  onClick={() => setRole('participant')}
                  className={`relative flex-1 rounded-md border-none bg-transparent p-2 font-sp-font text-[13px] cursor-pointer transition-colors duration-150 ${role === 'participant' ? 'font-bold text-sp-bg' : 'font-semibold text-sp-text-dimmer'}`}
                >Participant</button>
                <button
                  onClick={() => setRole('observer')}
                  className={`relative flex-1 rounded-md border-none bg-transparent p-2 font-sp-font text-[13px] cursor-pointer transition-colors duration-150 ${role === 'observer' ? 'font-bold text-sp-bg' : 'font-semibold text-sp-text-dimmer'}`}
                >Observer</button>
              </div>
            </div>

            {mode === 'create' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-sp-text-faint">Estimation deck</label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-sp-border bg-sp-bg p-[3px]">
                  {DECK_ORDER.map((id, i) => {
                    // Odd-length list: the last item would otherwise land alone
                    // in a 2-column grid, leaving one empty cell beside it --
                    // span it across both columns instead so the row still
                    // fills edge to edge with no gap.
                    const isLastOdd = DECK_ORDER.length % 2 === 1 && i === DECK_ORDER.length - 1;
                    return (
                      <button
                        key={id}
                        onClick={() => setDeck(id)}
                        className={`cursor-pointer rounded-md border-none p-2 font-sp-font text-[13px] transition-colors duration-150 ${isLastOdd ? 'col-span-2' : ''} ${
                          deck === id ? 'bg-sp-accent font-bold text-sp-bg' : 'bg-transparent font-semibold text-sp-text-dimmer'
                        }`}
                      >{DECKS[id].name}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === 'create' ? (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-sp-text-faint">Room code</label>
                <div className="w-full rounded-lg border border-sp-border bg-sp-bg px-3 py-2.5 font-sp-mono text-sm tracking-[0.1em] text-sp-accent-text">
                  {roomCodeInput} <span className="font-sp-font text-xs tracking-normal text-sp-text-placeholder">— new room</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-sp-text-faint">Room code</label>
                <input
                  value={roomCodeInput}
                  onChange={handleRoomCodeChange}
                  placeholder="Enter your room code"
                  maxLength={6}
                  className={`w-full rounded-lg border border-sp-border bg-sp-bg px-3 py-2.5 text-sm text-sp-text outline-none ${roomCodeInput ? 'font-sp-mono tracking-[0.1em] uppercase' : 'font-sp-font'}`}
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={joinDisabled}
              className={`mt-1.5 w-full rounded-lg border-none bg-sp-accent p-3 font-sp-font text-sm font-bold text-sp-bg ${joinDisabled ? 'cursor-default opacity-60' : 'cursor-pointer opacity-100'}`}
            >{busy ? 'Please wait…' : !ready ? 'Connecting…' : (mode === 'create' ? 'Create room' : 'Join room')}</button>

            {mode === 'join' ? (
              <button onClick={switchToCreate} className="cursor-pointer border-none bg-transparent p-0.5 text-center text-[13px] text-sp-text-faint">or create a new room</button>
            ) : (
              <button onClick={switchToJoin} className="cursor-pointer border-none bg-transparent p-0.5 text-center text-[13px] text-sp-text-faint">or join an existing room</button>
            )}

            {joinError && (
              <div className="text-center text-[13px] text-sp-warn-text">{joinError}</div>
            )}

            {!joinError && notice && (
              <div className="text-center text-[13px] text-sp-text-faint">{notice}</div>
            )}
          </div>
        </div>

        <div className="mt-[18px] text-center text-xs text-sp-text-placeholder">No account needed — just enter a name</div>
      </div>
    </div>
  );
}
