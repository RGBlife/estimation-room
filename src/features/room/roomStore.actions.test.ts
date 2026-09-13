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

const { setDeckAction } = await import('./roomStore.actions.ts');

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
