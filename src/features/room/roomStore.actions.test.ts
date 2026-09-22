import { describe, it, expect, vi, beforeEach } from 'vitest';

// The actions module talks to Firestore directly; mock the SDK so the write
// payloads themselves can be asserted without an emulator, the same approach
// roomStore.test.ts already takes for the store.
const updateDoc = vi.fn();

vi.mock('../../shared/lib/firebase.ts', () => ({ db: {}, auth: {}, rtdb: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ id })),
  updateDoc: (...args: unknown[]) => updateDoc(...args),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  deleteField: vi.fn(() => 'DELETE'),
}));

const { setDeckAction, renameRoomAction, createRoomAction } = await import('./roomStore.actions.ts');

const room = {
  code: 'ABCD',
  creatorId: 'u1',
  isRevealed: true,
  deck: 'fibonacci',
  participants: {
    u1: { name: 'Ada', isObserver: false, vote: '5', joinedAt: 0 },
    u2: { name: 'Bo', isObserver: false, vote: '8', joinedAt: 1 },
  },
} as never;

describe('setDeckAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears every vote and unreveals, so the switch starts a fresh round', async () => {
    // Clearing the votes without unrevealing left the room "revealed" with
    // nothing to show -- an empty results panel until someone started the
    // next round manually.
    await setDeckAction('ABCD', room, 'tshirt');

    expect(updateDoc).toHaveBeenCalledOnce();
    const payload = updateDoc.mock.calls[0][1];
    expect(payload).toMatchObject({
      deck: 'tshirt',
      isRevealed: false,
      'participants.u1.vote': null,
      'participants.u2.vote': null,
    });
  });
});

it('allows only the creator to rename, deletes blank names and rejects overlong names', async () => {
  updateDoc.mockClear();
  await expect(renameRoomAction('u2', 'ABCD', room, 'No')).rejects.toThrow('creator');
  await expect(renameRoomAction('u1', 'ABCD', room, 'x'.repeat(41))).rejects.toThrow('40');
  expect(updateDoc).not.toHaveBeenCalled();
  await renameRoomAction('u1', 'ABCD', room, ' Platform ');
  expect(updateDoc).toHaveBeenLastCalledWith({ id: 'ABCD' }, { teamName: 'Platform' });
  await renameRoomAction('u1', 'ABCD', room, '  ');
  expect(updateDoc).toHaveBeenLastCalledWith({ id: 'ABCD' }, { teamName: 'DELETE' });
});

it('creates with normalized names and omits blank or missing names', async () => {
  const { getDoc, setDoc } = await import('firebase/firestore');
  const { randomAvatar } = await import('../avatar/avatar.ts');
  vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
  const profile = { name: 'Ada', avatar: randomAvatar(), isObserver: false, deck: 'fibonacci' as const };
  for (const teamName of [undefined, ' ', ' Platform ']) {
    await createRoomAction('u1', { ...profile, teamName });
    const data = vi.mocked(setDoc).mock.calls.at(-1)![1];
    if (teamName?.trim()) expect(data).toHaveProperty('teamName', 'Platform');
    else expect(data).not.toHaveProperty('teamName');
  }
  await expect(createRoomAction('u1', { ...profile, teamName: 'x'.repeat(41) })).rejects.toThrow('40');
});
