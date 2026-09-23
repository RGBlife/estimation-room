import { expect, test } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteDoc, terminate, getDoc, deleteField } from 'firebase/firestore';

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
  const ticket = { key: 'DEMO-1', title: 'Test ticket', description: 'Acceptance criteria', team: 'Web', status: 'Backlog', source: 'demo' };
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
    await denied(updateDoc(ref(guest), { activeTicket: ticket }));
    await denied(updateDoc(ref(guest), { [`participants.${guest.uid}.vote`]: '5', activeTicket: ticket }));
    await denied(updateDoc(ref(guest), { readiness, teamName: 'Stolen' }));
    await expect(updateDoc(ref(host), { activeTicket: ticket, readiness, isRevealed: false })).resolves.toBeUndefined();
    await expect(updateDoc(ref(guest), { [`participants.${guest.uid}.vote`]: '5' })).resolves.toBeUndefined();
    await expect(updateDoc(ref(host), { isRevealed: true })).resolves.toBeUndefined();
    await denied(updateDoc(ref(guest), { isRevealed: false, activeTicket: deleteField() }));
    await expect(updateDoc(ref(guest), { isRevealed: false, [`participants.${guest.uid}.vote`]: null })).resolves.toBeUndefined();
    await denied(updateDoc(ref(host), { activeTicket: { ...ticket, title: 'x'.repeat(201) }, isRevealed: false }));
    await denied(updateDoc(ref(host), { activeTicket: { ...ticket, source: 'html' }, isRevealed: false }));
    await denied(updateDoc(ref(host), { activeTicket: ticket, creatorId: guest.uid }));
    expect((await getDoc(ref(host))).data()?.activeTicket).toEqual(ticket);
    await expect(updateDoc(ref(host), { activeTicket: deleteField(), readiness: {}, isRevealed: false })).resolves.toBeUndefined();
    expect((await getDoc(ref(host))).data()).not.toHaveProperty('activeTicket');
  } finally {
    await deleteDoc(ref(host));
    await Promise.all(clients.map(async c => { await terminate(c.db); await deleteApp(c.app); }));
  }
});
