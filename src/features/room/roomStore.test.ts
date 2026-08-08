import { describe, it, expect, vi, beforeEach } from 'vitest';

// The store's actions/presence modules import the real firebase/firestore,
// firebase/database, and firebase/auth SDKs (via shared/lib/firebase.ts).
// Rather than stand up a Firebase emulator for this test, mock the SDK calls
// the store itself makes directly (onSnapshot, onAuthStateChanged,
// signInAnonymously) and the action helper modules wholesale -- this tests
// the store's own state-transition logic (guard clauses, what set() calls
// happen, dismissThrow's filtering) without needing a real backend.
vi.mock('../../shared/lib/firebase.ts', () => ({
  db: {},
  auth: {},
  rtdb: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
  startAt: vi.fn(),
  onChildAdded: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInAnonymously: vi.fn(),
}));

vi.mock('./roomStore.presence.ts', () => ({
  clearMyPresence: vi.fn(),
  trackPresence: vi.fn(),
  teardownPresence: vi.fn(),
}));

const createRoomAction = vi.fn();
const joinRoomAction = vi.fn();
const setRoleAction = vi.fn();
const castVoteAction = vi.fn();
const setStoryAction = vi.fn();
const setDeckAction = vi.fn();
const revealAction = vi.fn();
const startNextRoundAction = vi.fn();
const throwWeaponAction = vi.fn();
const leaveAction = vi.fn();

vi.mock('./roomStore.actions.ts', () => ({
  createRoomAction: (...args: unknown[]) => createRoomAction(...args),
  joinRoomAction: (...args: unknown[]) => joinRoomAction(...args),
  setRoleAction: (...args: unknown[]) => setRoleAction(...args),
  castVoteAction: (...args: unknown[]) => castVoteAction(...args),
  setStoryAction: (...args: unknown[]) => setStoryAction(...args),
  setDeckAction: (...args: unknown[]) => setDeckAction(...args),
  revealAction: (...args: unknown[]) => revealAction(...args),
  startNextRoundAction: (...args: unknown[]) => startNextRoundAction(...args),
  throwWeaponAction: (...args: unknown[]) => throwWeaponAction(...args),
  leaveAction: (...args: unknown[]) => leaveAction(...args),
}));

const { useRoomStore } = await import('./roomStore.ts');

function resetStore() {
  useRoomStore.setState({
    uid: null,
    room: null,
    roomCode: null,
    error: null,
    notice: null,
    throws: [],
  });
}

describe('useRoomStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('dismissThrow removes only the matching throw by id', () => {
    useRoomStore.setState({
      throws: [
        { id: 'a', fromUid: 'u1', toUid: 'u2', weaponId: 'heart', ts: 1, offsetX: 0, offsetY: 0 },
        { id: 'b', fromUid: 'u1', toUid: 'u2', weaponId: 'heart', ts: 2, offsetX: 0, offsetY: 0 },
      ],
    });
    useRoomStore.getState().dismissThrow('a');
    expect(useRoomStore.getState().throws.map(t => t.id)).toEqual(['b']);
  });

  it('createRoom throws and does not call the action when not signed in', async () => {
    resetStore(); // uid: null
    await expect(useRoomStore.getState().createRoom({ name: 'Ada', avatar: {} as never, isObserver: false, deck: 'fibonacci' }))
      .rejects.toThrow('Not signed in yet');
    expect(createRoomAction).not.toHaveBeenCalled();
  });

  it('createRoom calls createRoomAction with the signed-in uid and returns its code', async () => {
    useRoomStore.setState({ uid: 'u1' });
    createRoomAction.mockResolvedValue('ABCD');
    const payload = { name: 'Ada', avatar: {} as never, isObserver: false, deck: 'fibonacci' as const };

    const code = await useRoomStore.getState().createRoom(payload);

    expect(code).toBe('ABCD');
    expect(createRoomAction).toHaveBeenCalledWith('u1', payload);
    expect(useRoomStore.getState().roomCode).toBe('ABCD');
  });

  it('setRole/castVote/setStory/reveal/throwWeapon are no-ops without a joined room', async () => {
    useRoomStore.setState({ uid: 'u1', roomCode: null });
    await useRoomStore.getState().setRole(true);
    await useRoomStore.getState().castVote('5');
    await useRoomStore.getState().setStory('story');
    await useRoomStore.getState().reveal();
    await useRoomStore.getState().throwWeapon('u2', 'heart');

    expect(setRoleAction).not.toHaveBeenCalled();
    expect(castVoteAction).not.toHaveBeenCalled();
    expect(setStoryAction).not.toHaveBeenCalled();
    expect(revealAction).not.toHaveBeenCalled();
    expect(throwWeaponAction).not.toHaveBeenCalled();
  });

  it('castVote forwards to castVoteAction once uid and roomCode are set', async () => {
    useRoomStore.setState({ uid: 'u1', roomCode: 'ABCD', room: null });
    await useRoomStore.getState().castVote('8');
    expect(castVoteAction).toHaveBeenCalledWith('u1', 'ABCD', null, '8');
  });

  it('setDeck is a no-op without a roomCode or room', async () => {
    useRoomStore.setState({ uid: 'u1', roomCode: null, room: null });
    await useRoomStore.getState().setDeck('tshirt');
    expect(setDeckAction).not.toHaveBeenCalled();

    useRoomStore.setState({ uid: 'u1', roomCode: 'ABCD', room: null });
    await useRoomStore.getState().setDeck('tshirt');
    expect(setDeckAction).not.toHaveBeenCalled();
  });

  it('setDeck forwards to setDeckAction with roomCode, room, and the new deck id', async () => {
    const room = { code: 'ABCD', participants: {} } as never;
    useRoomStore.setState({ uid: 'u1', roomCode: 'ABCD', room });
    await useRoomStore.getState().setDeck('tshirt');
    expect(setDeckAction).toHaveBeenCalledWith('ABCD', room, 'tshirt');
  });

  it('leave is a no-op without uid/roomCode, and calls leaveAction + resets state when joined', async () => {
    useRoomStore.setState({ uid: null, roomCode: null });
    await useRoomStore.getState().leave();
    expect(leaveAction).not.toHaveBeenCalled();

    useRoomStore.setState({ uid: 'u1', roomCode: 'ABCD', room: { code: 'ABCD' } as never });
    await useRoomStore.getState().leave();
    expect(leaveAction).toHaveBeenCalledWith('u1', 'ABCD');
    expect(useRoomStore.getState().room).toBeNull();
    expect(useRoomStore.getState().roomCode).toBeNull();
  });
});
