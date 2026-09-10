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
  const [role, setRole] = useState<'participant' | 'observer'>(storedProfile?.isObserver ? 'observer' : 'participant');
  const [deck, setDeck] = useState<DeckId>(DEFAULT_DECK);
  const [roomCodeInput, setRoomCodeInput] = useState(prefillRoomCode ?? '');
  const [busy, setBusy] = useState(false);
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const panelWidth = useAvatarPanelWidth(avatarExpanded);
  const cardMaxWidth = panelWidth ? panelWidth + 56 : 460;

  // Persist as the user customizes, not just on join, so the look/name/role
  // survives closing the tab even if they never actually joined a room.
  useEffect(() => {
    saveProfile({ name: name.trim().slice(0, 40), avatar, isObserver: role === 'observer' });
  }, [name, avatar, role]);

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
    <div className="sp-join flex flex-1 items-center justify-center">
      <div className="sp-join-layout" data-expanded={avatarExpanded} style={{ maxWidth: avatarExpanded ? cardMaxWidth + 370 : 1000 }}>
        <header className="sp-join-header">
          <div className="sp-wordmark">
            <span className="sp-brand-cards" aria-hidden="true"><i /><i /></span>
            <span>Estimation Room</span>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </header>

        <div className="sp-join-workspace">
          <div className="sp-join-intro">
            <h1>What’s your <br />estimate?</h1>
            <p>Planning poker for your team. Vote privately, reveal together, and talk through the differences.</p>
            <div className="sp-card-hand" aria-hidden="true">
              {[3, 5, 8].map(value => (
                <div className="sp-intro-card" key={value}>
                  <span>{value}</span><strong>{value}</strong><span>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
          <div onKeyDown={handleKeyDown} className="sp-join-card">
          <div className="sp-join-card-heading">
            <h2>{mode === 'create' ? 'Start a session' : 'Take a seat'}</h2>
            <p>{mode === 'create' ? 'Choose a deck. Share the room code.' : 'Set your name and enter your room code.'}</p>
          </div>

          <AvatarBuilder avatar={avatar} onChange={setAvatar} onExpandedChange={setAvatarExpanded} />

          <div className="sp-join-fields flex flex-col gap-3.5">
            <div>
              <label htmlFor="join-name" className="mb-1.5 block text-xs font-semibold text-sp-text-faint">Your name</label>
              <input
                id="join-name"
                autoComplete="name"
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
                  aria-pressed={role === 'participant'}
                  className={`relative flex-1 rounded-md border-none bg-transparent p-2 font-sp-font text-[13px] cursor-pointer transition-colors duration-150 ${role === 'participant' ? 'font-bold text-sp-bg' : 'font-semibold text-sp-text-dimmer'}`}
                >Participant</button>
                <button
                  onClick={() => setRole('observer')}
                  aria-pressed={role === 'observer'}
                  className={`relative flex-1 rounded-md border-none bg-transparent p-2 font-sp-font text-[13px] cursor-pointer transition-colors duration-150 ${role === 'observer' ? 'font-bold text-sp-bg' : 'font-semibold text-sp-text-dimmer'}`}
                >Observer</button>
              </div>
            </div>

            {mode === 'create' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-sp-text-faint">Estimation deck</label>
                <div className="grid grid-cols-2 gap-x-[1px] gap-y-1 rounded-lg border border-sp-border bg-sp-bg p-[3px]">
                  {DECK_ORDER.map((id, i) => {
                    // Odd-length list: the last item would otherwise land alone
                    // in a 2-column grid, leaving one empty cell beside it --
                    // span it across both columns instead so the row still
                    // fills edge to edge with no gap.
                    const isLastOdd = DECK_ORDER.length % 2 === 1 && i === DECK_ORDER.length - 1;
                    const isSelected = deck === id;
                    // A thin divider on the left of every option except the
                    // first in each row (and never on the full-width odd
                    // item) makes the 5 choices read as a single row of
                    // options rather than two loose pairs, the way the role
                    // toggle's shared pill boundary already does for its 2
                    // options -- but a static border would visually cut
                    // through the selected pill's own rounded background, so
                    // it's suppressed on the selected option and its
                    // right-hand neighbor (whose left edge would otherwise
                    // sit flush against the selected pill).
                    const showDivider = !isLastOdd && i % 2 === 1 && !isSelected && deck !== DECK_ORDER[i - 1];
                    return (
                      <button
                        key={id}
                        onClick={() => setDeck(id)}
                        aria-pressed={isSelected}
                        className={`relative cursor-pointer rounded-md border-none p-2 font-sp-font text-[13px] transition-[background-color,color,transform] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isLastOdd ? 'col-span-2' : ''} ${
                          isSelected ? 'scale-[1.03] bg-sp-accent font-bold text-sp-bg' : 'scale-100 bg-transparent font-semibold text-sp-text-dimmer'
                        } ${showDivider ? 'before:absolute before:top-1/2 before:left-0 before:h-[60%] before:w-px before:-translate-x-1/2 before:-translate-y-1/2 before:bg-sp-border' : ''}`}
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
                <label htmlFor="join-code" className="mb-1.5 block text-xs font-semibold text-sp-text-faint">Room code</label>
                <input
                  id="join-code"
                  autoComplete="off"
                  spellCheck={false}
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
              <div role="alert" className="text-center text-[13px] text-sp-warn-text">{joinError}</div>
            )}

            {!joinError && notice && (
              <div className="text-center text-[13px] text-sp-text-faint">{notice}</div>
            )}
          </div>
        </div>

          <p className="sp-join-footnote">No account needed. Your avatar is saved on this device.</p>
          {import.meta.env.DEV && (
            <p className="sp-join-footnote">
              <a href="?visual-test=room&seats=10&observers=4">Preview 10 players and 4 observers</a>
            </p>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
