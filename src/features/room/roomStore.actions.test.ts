import { describe, it, expect, vi, beforeEach } from 'vitest';

// The actions module talks to Firestore directly; mock the SDK so the write
// payloads themselves can be asserted without an emulator, the same approach
// roomStore.test.ts already takes for the store.
const updateDoc = vi.fn();
const transactionGet = vi.fn();
const transactionUpdate = vi.fn();

vi.mock('../../shared/lib/firebase.ts', () => ({ db: {}, auth: {}, rtdb: {} }));
const transactionSet = vi.fn();
const batch = { set: vi.fn(), delete: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
vi.mock('firebase/firestore', () => ({
  runTransaction: vi.fn(async (_db, callback) => callback({ get: transactionGet, update: transactionUpdate, set: transactionSet })),
  writeBatch: vi.fn(() => batch),
  doc: vi.fn((_db, _col, id, _sub, ticketId) => (ticketId ? { id: ticketId, room: id } : { id })),
  updateDoc: (...args: unknown[]) => updateDoc(...args),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  deleteField: vi.fn(() => 'DELETE'),
}));

const { setDeckAction, renameRoomAction, createRoomAction, changeReadinessAction, selectTicketAction, changeBacklogAction, leaveAction } = await import('./roomStore.actions.ts');
const firestore = await import('firebase/firestore');

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

it('changes readiness against the transaction snapshot and atomically resets when selecting a ticket', async () => {
  const snapshot = { code: 'ABCD', creatorId: 'u1', readiness: { a: { text: 'Ready', checked: true } }, participants: { u1: { name: 'Ada', vote: '5' }, u2: { name: 'Bo', vote: '8' } } };
  transactionGet.mockResolvedValue({ exists: () => true, data: () => snapshot });
  await changeReadinessAction('u2', 'ABCD', { operation: 'add', id: 'b', text: 'Testable' });
  expect(transactionUpdate).toHaveBeenLastCalledWith({ id: 'ABCD' }, { readiness: { a: { text: 'Ready', checked: true }, b: { text: 'Testable', checked: false } } });
  await expect(changeReadinessAction('outsider', 'ABCD', { operation: 'remove', id: 'a' })).rejects.toThrow('no longer');
  await expect(selectTicketAction('u2', 'ABCD', null)).rejects.toThrow('creator');
  await selectTicketAction('u1', 'ABCD', null);
  expect(transactionUpdate).toHaveBeenLastCalledWith({ id: 'ABCD' }, {
    activeTicketId: 'DELETE', activeTicket: 'DELETE', readiness: { a: { text: 'Ready', checked: false } }, isRevealed: false,
    participants: { u1: { name: 'Ada', vote: null }, u2: { name: 'Bo', vote: null } },
  });
  transactionGet.mockResolvedValueOnce({ exists: () => true, data: () => snapshot }).mockResolvedValueOnce({ exists: () => false });
  await expect(selectTicketAction('u1', 'ABCD', 'gone')).rejects.toThrow('removed');
});

it('writes backlog changes as their author, one ticket document each', async () => {
  vi.clearAllMocks();
  const room = { code: 'ABCD', creatorId: 'u1', activeTicketId: 't1', participants: { u1: { name: 'Ada' }, u2: { name: 'Bo' } } } as never;
  await changeBacklogAction('u2', 'ABCD', room, [], { operation: 'add', tickets: [{ id: 't1', key: ' WEB-1 ', title: 'Keep filters' }] });
  expect(batch.set).toHaveBeenCalledWith({ id: 't1', room: 'ABCD' }, expect.objectContaining({ key: 'WEB-1', title: 'Keep filters', position: 1, added: expect.objectContaining({ uid: 'u2', name: 'Bo' }) }));
  expect(batch.set.mock.calls[0][1]).not.toHaveProperty('id');
  const stored = { title: 'Keep filters', description: 'Restore the search.', position: 1, added: { uid: 'u2', name: 'Bo', at: 1 } };
  transactionGet.mockResolvedValue({ exists: () => true, id: 't1', data: () => stored });
  await changeBacklogAction('u1', 'ABCD', room, [], { operation: 'edit', id: 't1', field: 'title', value: 'Keep search filters' });
  expect(transactionSet).toHaveBeenLastCalledWith({ id: 't1', room: 'ABCD' }, expect.objectContaining({ title: 'Keep search filters', edited: { title: expect.objectContaining({ uid: 'u1', name: 'Ada' }) } }));
  await changeBacklogAction('u2', 'ABCD', room, [], { operation: 'highlight', id: 't1', highlightId: 'h1', start: 0, end: 7 });
  expect(transactionSet.mock.lastCall![1].highlights).toEqual([expect.objectContaining({ start: 0, end: 7, by: expect.objectContaining({ name: 'Bo' }) })]);
  await expect(changeBacklogAction('u2', 'ABCD', room, [], { operation: 'remove', id: 't1' })).rejects.toThrow('at the table');
  await expect(changeBacklogAction('u2', 'ABCD', room, [], { operation: 'clear' })).rejects.toThrow('creator');
  await expect(changeBacklogAction('u3', 'ABCD', room, [], { operation: 'clear' })).rejects.toThrow('no longer');
  batch.update.mockClear();
  await changeBacklogAction('u1', 'ABCD', { ...(room as object), readiness: {} } as never, [{ id: 't1', ...stored }], { operation: 'clear' });
  expect(batch.delete).toHaveBeenCalledWith({ id: 't1', room: 'ABCD' });
  expect(batch.update).toHaveBeenCalledWith({ id: 'ABCD' }, expect.objectContaining({ activeTicketId: 'DELETE', isRevealed: false }));
});

describe('leaveAction', () => {
  beforeEach(() => vi.clearAllMocks());
  const snapshot = (participants: object) => ({ exists: () => true, data: () => ({ code: 'ABCD', participants }) });

  it('keeps the room when the last person leaves, so it can be rejoined', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce(snapshot({ u1: {} }) as never);
    await leaveAction('u1', 'ABCD');
    expect(updateDoc).toHaveBeenCalledExactlyOnceWith({ id: 'ABCD' }, { 'participants.u1': 'DELETE' });
    expect(firestore.deleteDoc).not.toHaveBeenCalled();
  });

  it('removes only the leaver when others remain', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce(snapshot({ u1: {}, u2: {} }) as never);
    await leaveAction('u1', 'ABCD');
    expect(updateDoc).toHaveBeenCalledExactlyOnceWith({ id: 'ABCD' }, { 'participants.u1': 'DELETE' });
    expect(firestore.deleteDoc).not.toHaveBeenCalled();
  });
});
