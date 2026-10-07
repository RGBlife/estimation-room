import { expect, test } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteDoc, terminate, getDoc, getDocs, collection, deleteField, writeBatch } from 'firebase/firestore';

test('planning rules validate all criteria and isolate ticket selection from ordinary updates', async () => {
  test.skip(process.env.ROOM_TEST_BACKEND !== 'firebase', 'Firestore emulator only');
  const clients = await Promise.all(['host', 'guest', 'outsider'].map(async name => {
    const app = initializeApp({ projectId: 'demo-scrum-poker', apiKey: 'demo-key' }, `planning-${name}-${Date.now()}`);
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const uid = (await signInAnonymously(auth)).user.uid;
    const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
    return { app, db, uid };
  }));
  const [host, guest, outsider] = clients;
  const code = `PLAN${Date.now()}`;
  const ref = (client: typeof host) => doc(client.db, 'rooms', code);
  const person = { name: 'Test', isObserver: false, vote: null, joinedAt: 1, avatar: { seed: 'test', bgIdx: 0, glasses: false, earrings: false, flair: false } };
  const readiness = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, { text: 'Ready', checked: false }]));
  const legacy = { key: 'DEMO-1', title: 'Test ticket', description: 'Acceptance criteria', team: 'Web', status: 'Backlog', source: 'demo' };
  const tref = (client: typeof host, id = 't1') => doc(client.db, 'rooms', code, 'tickets', id);
  const by = (client: typeof host, name = 'Test') => ({ uid: client.uid, name, at: Date.now() });
  const ticket = (client: typeof host) => ({ key: 'WEB-1', title: 'Keep filters', description: 'Restore the search context.', position: 1, added: by(client) });
  const denied = (write: Promise<unknown>) => expect(write).rejects.toMatchObject({ code: 'permission-denied' });
  try {
    await setDoc(ref(host), { code, creatorId: host.uid, deck: 'fibonacci', isRevealed: false, participants: { [host.uid]: person } });
    await expect(updateDoc(ref(guest), { [`participants.${guest.uid}`]: person })).resolves.toBeUndefined();
    await denied(updateDoc(ref(outsider), { readiness }));
    await expect(updateDoc(ref(guest), { readiness })).resolves.toBeUndefined();
    await expect(updateDoc(ref(guest), { 'readiness.c11.checked': true })).resolves.toBeUndefined();
    await denied(updateDoc(ref(guest), { 'readiness.c11.text': 'x'.repeat(161) }));
    await denied(updateDoc(ref(guest), { 'readiness.c11.checked': 'yes' }));
    await denied(updateDoc(ref(guest), { readiness: { 'a,b': { text: 'Invalid ID', checked: false } } }));
    await denied(updateDoc(ref(guest), { readiness: { a: { text: ' ', checked: false } } }));
    await denied(updateDoc(ref(guest), { readiness: { ...readiness, extra: { text: 'Extra', checked: false } } }));
    await denied(updateDoc(ref(guest), { readiness, teamName: 'Stolen' }));

    // The backlog: participants only, attributed honestly, plain shapes.
    await denied(setDoc(tref(outsider), ticket(outsider)));
    await denied(setDoc(tref(guest), { ...ticket(guest), added: by(host) }));
    await denied(setDoc(tref(guest), { ...ticket(guest), added: by(guest, 'Someone else') }));
    await denied(setDoc(tref(guest), { ...ticket(guest), assignee: 'Ada Lovelace' }));
    await denied(setDoc(tref(guest), { ...ticket(guest), description: 'x'.repeat(2001) }));
    await denied(setDoc(tref(guest, 'bad id'), ticket(guest)));
    await expect(setDoc(tref(guest), ticket(guest))).resolves.toBeUndefined();
    await denied(getDoc(tref(outsider)));
    await denied(getDocs(collection(outsider.db, 'rooms', code, 'tickets')));
    expect((await getDocs(collection(host.db, 'rooms', code, 'tickets'))).size).toBe(1);
    await expect(updateDoc(tref(host), { title: 'Keep search filters', 'edited.title': by(host) })).resolves.toBeUndefined();
    await denied(updateDoc(tref(host), { title: 'Unattributed' }));
    await denied(updateDoc(tref(host), { title: 'Blamed on guest', 'edited.title': by(guest) }));
    await denied(updateDoc(tref(host), { 'edited.key': by(host) }));
    await denied(updateDoc(tref(host), { position: 9 }));
    await denied(updateDoc(tref(host), { added: by(host) }));
    const mark = (client: typeof host, id: string, start: number, end: number) => ({ id, start, end, by: by(client) });
    await expect(updateDoc(tref(guest), { highlights: [mark(guest, 'h1', 0, 7)] })).resolves.toBeUndefined();
    const marked = (await getDoc(tref(host))).data()!.highlights;
    await denied(updateDoc(tref(host), { highlights: [...marked, mark(guest, 'h2', 8, 11)] }));
    await denied(updateDoc(tref(host), { highlights: [...marked, mark(host, 'h2', 8, 999)] }));
    await expect(updateDoc(tref(host), { highlights: [...marked, mark(host, 'h2', 8, 11)] })).resolves.toBeUndefined();
    await expect(updateDoc(tref(host), { highlights: (await getDoc(tref(host))).data()!.highlights.slice(1) })).resolves.toBeUndefined();

    // Selection names a backlog ticket and resets the round, creator only.
    await denied(updateDoc(ref(guest), { activeTicketId: 't1' }));
    await denied(updateDoc(ref(host), { activeTicketId: 'missing', isRevealed: false }));
    await denied(updateDoc(ref(host), { activeTicket: legacy, isRevealed: false }));
    await expect(updateDoc(ref(host), { activeTicketId: 't1', readiness, isRevealed: false })).resolves.toBeUndefined();
    await denied(deleteDoc(tref(guest)));
    await expect(updateDoc(ref(guest), { [`participants.${guest.uid}.vote`]: '5' })).resolves.toBeUndefined();
    await expect(updateDoc(ref(host), { isRevealed: true })).resolves.toBeUndefined();
    // A revealed round records its estimate on the ticket at the table only.
    await expect(updateDoc(tref(guest), { estimate: { value: '5', at: Date.now() } })).resolves.toBeUndefined();
    await denied(updateDoc(tref(guest), { estimate: { value: '8', at: Date.now() }, title: 'Sneaked in' }));
    await denied(updateDoc(tref(guest), { estimate: { value: 'x'.repeat(41), at: Date.now() } }));
    await denied(updateDoc(ref(guest), { isRevealed: false, activeTicketId: deleteField() }));
    await expect(updateDoc(ref(guest), { isRevealed: false, [`participants.${guest.uid}.vote`]: null })).resolves.toBeUndefined();
    await denied(updateDoc(tref(guest), { estimate: { value: '13', at: Date.now() } }));
    await denied(updateDoc(ref(host), { activeTicketId: 't1', creatorId: guest.uid }));
    // Clearing the backlog drops the selection in the same batch.
    const clear = writeBatch(host.db);
    clear.delete(tref(host));
    clear.update(ref(host), { activeTicketId: deleteField(), readiness: {}, isRevealed: false });
    await expect(clear.commit()).resolves.toBeUndefined();
    expect((await getDoc(ref(host))).data()).not.toHaveProperty('activeTicketId');
    // Leaving the room ends access to its backlog.
    await setDoc(tref(guest, 't2'), { ...ticket(guest), position: 2 });
    await updateDoc(ref(guest), { [`participants.${guest.uid}`]: deleteField() });
    await denied(getDoc(tref(guest, 't2')));
    await deleteDoc(tref(host, 't2'));
  } finally {
    await deleteDoc(ref(host));
    await Promise.all(clients.map(async c => { await terminate(c.db); await deleteApp(c.app); }));
  }
});
