import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, deleteField,
} from 'firebase/firestore';
import {
  ref as rtdbRef, onDisconnect, set as rtdbSet, remove as rtdbRemove, push,
} from 'firebase/database';
import { db, rtdb } from '../../shared/lib/firebase.ts';
import { randomRoomCode } from '../join/roomCode.ts';
import type { JoinPayload, CardValue, RoomDoc, DeckId } from '../../types/room.ts';

const MAX_CREATE_ATTEMPTS = 3;

// Longest flight (the paper airplane's 0.95s glide) + impact (0.85s), plus
// margin, before the thrower cleans up their own throw node.
const THROW_CLEANUP_MS = 2200;

export async function createRoomAction(uid: string, { name, avatar, isObserver, deck }: JoinPayload): Promise<string> {
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const code = randomRoomCode();
    const ref = doc(db, 'rooms', code);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;
    const data = {
      code,
      isRevealed: false,
      creatorId: uid,
      deck,
      createdAt: serverTimestamp(),
      participants: {
        [uid]: { name, avatar, isObserver, vote: null, joinedAt: Date.now() },
      },
    };
    await setDoc(ref, data);
    return code;
  }
  throw new Error('Could not allocate a room code, please try again');
}

export async function joinRoomAction(uid: string, code: string, { name, avatar, isObserver }: JoinPayload): Promise<void> {
  const ref = doc(db, 'rooms', code);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Room not found');
  }
  await updateDoc(ref, {
    [`participants.${uid}`]: { name, avatar, isObserver, vote: null, joinedAt: Date.now() },
  });
}

export async function setRoleAction(uid: string, roomCode: string, room: RoomDoc | null, isObserver: boolean): Promise<void> {
  if (!room?.participants?.[uid]) throw new Error('Not in this room');
  await updateDoc(doc(db, 'rooms', roomCode), {
    [`participants.${uid}.isObserver`]: isObserver,
    [`participants.${uid}.vote`]: null,
  });
}

export async function castVoteAction(uid: string, roomCode: string, room: RoomDoc | null, value: CardValue): Promise<void> {
  // A partial write here would recreate us as a corrupt participant if
  // disconnect cleanup removed us a moment ago.
  if (!room?.participants?.[uid]) throw new Error('Not in this room');
  await updateDoc(doc(db, 'rooms', roomCode), {
    [`participants.${uid}.vote`]: value,
  });
}

export async function setDeckAction(roomCode: string, room: RoomDoc, deckId: DeckId): Promise<void> {
  const clearedVotes: Record<string, null> = {};
  for (const pid of Object.keys(room.participants)) {
    clearedVotes[`participants.${pid}.vote`] = null;
  }
  await updateDoc(doc(db, 'rooms', roomCode), {
    deck: deckId,
    ...clearedVotes,
  });
}

export async function revealAction(roomCode: string): Promise<void> {
  await updateDoc(doc(db, 'rooms', roomCode), { isRevealed: true });
}

export async function startNextRoundAction(roomCode: string, room: RoomDoc): Promise<void> {
  const clearedVotes: Record<string, null> = {};
  for (const pid of Object.keys(room.participants)) {
    clearedVotes[`participants.${pid}.vote`] = null;
  }
  await updateDoc(doc(db, 'rooms', roomCode), {
    isRevealed: false,
    ...clearedVotes,
  });
}

// Observers can be hit but can't throw — enforced here, not just in the UI.
// offsetX/offsetY (roughly -0.5..0.5, fraction of the target avatar's size)
// let the impact land wherever on the avatar was actually clicked, instead
// of always snapping to its center.
export async function throwWeaponAction(
  uid: string,
  roomCode: string,
  room: RoomDoc | null,
  targetUid: string,
  weaponId: string,
  offsetX = 0,
  offsetY = 0,
): Promise<void> {
  const me = room?.participants?.[uid];
  if (!me || me.isObserver) return;
  const throwsListRef = rtdbRef(rtdb, `throws/${roomCode}`);
  const newThrowRef = push(throwsListRef);
  onDisconnect(newThrowRef).remove().catch(() => {});
  await rtdbSet(newThrowRef, { fromUid: uid, toUid: targetUid, weaponId, ts: Date.now(), offsetX, offsetY });
  setTimeout(() => {
    onDisconnect(newThrowRef).cancel().catch(() => {});
    rtdbRemove(newThrowRef).catch(() => {});
  }, THROW_CLEANUP_MS);
}

export async function leaveAction(uid: string, code: string): Promise<void> {
  try {
    const ref = doc(db, 'rooms', code);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const remaining = Object.keys((snap.data() as RoomDoc).participants).filter(id => id !== uid);
    if (remaining.length === 0) {
      await deleteDoc(ref);
    } else {
      await updateDoc(ref, { [`participants.${uid}`]: deleteField() });
      // If several people left at once, everyone saw someone else remaining
      // and nobody took the delete branch — re-check so the last write out
      // still cleans up the empty room.
      const after = await getDoc(ref);
      if (after.exists() && Object.keys((after.data() as RoomDoc).participants).length === 0) {
        await deleteDoc(ref);
      }
    }
  } catch {
    // Best-effort: if this fails (e.g. offline), other clients' disconnect
    // cleanup removes us once our presence entry drops.
  }
}
