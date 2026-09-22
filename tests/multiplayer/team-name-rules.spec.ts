import { expect, test } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteDoc, deleteField, terminate } from 'firebase/firestore';

test('Firestore pins team names in every ordinary update branch', async () => {
  test.skip(process.env.ROOM_TEST_BACKEND !== 'firebase', 'Firestore emulator only');
  const clients = await Promise.all(['host', 'guest', 'outsider'].map(async name => {
    const app = initializeApp({ projectId: 'demo-scrum-poker', apiKey: 'demo-key' }, `teams-${name}-${Date.now()}`);
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const uid = (await signInAnonymously(auth)).user.uid;
    const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
    return { app, db, uid };
  }));
  const [host, guest, outsider] = clients;
  const code = `RULE${Date.now()}`;
  const ref = (client: typeof host) => doc(client.db, 'rooms', code);
  const person = { name: 'Test', isObserver: false, vote: null, joinedAt: 1, avatar: { seed: 'test', bgIdx: 0, hairIdx: 0, hairColorIdx: 0, skinColorIdx: 0, eyesIdx: 0, eyebrowsIdx: 0, mouthIdx: 0, glassesIdx: 0, glassesIdxOn: false, earringsIdx: 0, earringsIdxOn: false, featureIdx: 0, featureIdxOn: false } };
  const room = { code, creatorId: host.uid, deck: 'fibonacci', isRevealed: false, participants: { [host.uid]: person, [guest.uid]: person } };
  const denied = (write: Promise<unknown>) => expect(write).rejects.toMatchObject({ code: 'permission-denied' });
  try {
    // Creation accepts old documents; malformed names are rejected at the boundary.
    for (const teamName of ['', ' ', ' padded ', 'x'.repeat(41), 7, null]) {
      await denied(setDoc(ref(host), { ...room, participants: { [host.uid]: person }, teamName }));
    }
    await setDoc(ref(host), { ...room, participants: { [host.uid]: person } });
    await denied(updateDoc(ref(outsider), { [`participants.${outsider.uid}`]: person, teamName: 'Stolen' }));
    await updateDoc(ref(guest), { [`participants.${guest.uid}`]: person });
    await denied(updateDoc(ref(guest), { teamName: '' }));
    await updateDoc(ref(host), { teamName: 'x'.repeat(40) });
    for (const teamName of ['Stolen', deleteField()]) {
      await denied(updateDoc(ref(guest), { teamName }));
      await denied(updateDoc(ref(guest), { [`participants.${guest.uid}.vote`]: '5', teamName }));
      await denied(updateDoc(ref(guest), { [`participants.${guest.uid}`]: deleteField(), teamName }));
      await denied(updateDoc(ref(guest), { [`participants.${host.uid}`]: deleteField(), teamName }));
      await denied(updateDoc(ref(guest), { isRevealed: true, teamName }));
      await denied(updateDoc(ref(host), { deck: 'tshirt', teamName }));
    }
    await updateDoc(ref(guest), { [`participants.${guest.uid}.vote`]: '5' });
    await updateDoc(ref(guest), { isRevealed: true });
    await denied(updateDoc(ref(guest), { isRevealed: false, teamName: 'Stolen' }));
    await denied(updateDoc(ref(guest), { isRevealed: false, creatorId: guest.uid }));
    await denied(updateDoc(ref(guest), { isRevealed: false, code: 'EVIL' }));
    await updateDoc(ref(guest), { isRevealed: false, [`participants.${guest.uid}.vote`]: null });
    await updateDoc(ref(host), { teamName: deleteField() });
    await updateDoc(ref(guest), { [`participants.${guest.uid}.vote`]: '8' });
    await denied(updateDoc(ref(host), { teamName: 'x'.repeat(41) }));
    await denied(updateDoc(ref(host), { teamName: null }));
    await updateDoc(ref(host), { deck: 'tshirt', isRevealed: false, [`participants.${guest.uid}.vote`]: null });
    await updateDoc(ref(outsider), { [`participants.${outsider.uid}`]: person });
    await updateDoc(ref(guest), { [`participants.${outsider.uid}`]: deleteField() });
    await updateDoc(ref(guest), { [`participants.${guest.uid}`]: deleteField() });
  } finally {
    await deleteDoc(ref(host));
    await Promise.all(clients.map(async c => { await terminate(c.db); await deleteApp(c.app); }));
  }
});
