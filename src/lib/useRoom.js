import { useCallback, useEffect, useRef, useState } from 'react';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, deleteField,
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  ref as rtdbRef, onValue, onDisconnect, set as rtdbSet, remove as rtdbRemove,
  query, orderByChild, startAt, onChildAdded, push,
} from 'firebase/database';
import { db, auth, rtdb } from '../firebase.js';
import { randomRoomCode } from './roomCode.js';

const MAX_CREATE_ATTEMPTS = 3;

// How long a participant must be continuously absent from presence before any
// client removes them from the room. Absorbs brief RTDB reconnects, which
// would otherwise get people kicked (and their next write would recreate them
// as a corrupt half-participant).
const STALE_GRACE_MS = 8000;

// Fly (0.55s) + impact (0.85s) animation, plus margin, before the thrower
// cleans up their own throw node.
const THROW_CLEANUP_MS = 1800;

function clearMyPresence(code, myUid) {
  const myPresenceRef = rtdbRef(rtdb, `presence/${code}/${myUid}`);
  onDisconnect(myPresenceRef).cancel().catch(() => {});
  rtdbRemove(myPresenceRef).catch(() => {});
}

export function useRoom() {
  const [uid, setUid] = useState(null);
  const [room, setRoom] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [throws, setThrows] = useState([]);
  const unsubscribeRef = useRef(null);
  const presenceUnsubscribeRef = useRef(null);
  const connectedUnsubscribeRef = useRef(null);
  const throwsUnsubscribeRef = useRef(null);
  const subscribeStartAtRef = useRef(0);
  const graceTimerRef = useRef(null);
  const staleSinceRef = useRef({});
  const presenceSnapshotRef = useRef({});
  const roomRef = useRef(null);
  roomRef.current = room;
  const uidRef = useRef(null);
  uidRef.current = uid;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        setUid(user.uid);
      } else {
        signInAnonymously(auth).catch(err => setError(err.message));
      }
    });
    return unsub;
  }, []);

  const teardown = useCallback(() => {
    if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
    if (presenceUnsubscribeRef.current) { presenceUnsubscribeRef.current(); presenceUnsubscribeRef.current = null; }
    if (connectedUnsubscribeRef.current) { connectedUnsubscribeRef.current(); connectedUnsubscribeRef.current = null; }
    if (throwsUnsubscribeRef.current) { throwsUnsubscribeRef.current(); throwsUnsubscribeRef.current = null; }
    if (graceTimerRef.current) { clearTimeout(graceTimerRef.current); graceTimerRef.current = null; }
    staleSinceRef.current = {};
    presenceSnapshotRef.current = {};
    setThrows([]);
  }, []);

  useEffect(() => teardown, [teardown]);

  // Removes participants who have been absent from presence for the full grace
  // period. Runs on every presence change and re-schedules itself while
  // anyone's absence is still within the grace window.
  const reviewPresence = useCallback((code, myUid) => {
    if (graceTimerRef.current) { clearTimeout(graceTimerRef.current); graceTimerRef.current = null; }
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    const present = presenceSnapshotRef.current;
    // If our own presence entry is missing, we may be the one who lost the
    // connection — our view of who's present is suspect, so remove no one.
    if (!(myUid in present)) return;
    const now = Date.now();
    const staleSince = staleSinceRef.current;
    const participantIds = Object.keys(currentRoom.participants);
    for (const id of Object.keys(staleSince)) {
      if (!participantIds.includes(id) || id in present) delete staleSince[id];
    }
    let nextCheckAt = Infinity;
    for (const id of participantIds) {
      if (id in present || id === myUid) continue;
      if (!(id in staleSince)) staleSince[id] = now;
      const dueAt = staleSince[id] + STALE_GRACE_MS;
      if (dueAt <= now) {
        // Security rules allow removing only one other participant per write.
        updateDoc(doc(db, 'rooms', code), { [`participants.${id}`]: deleteField() }).catch(() => {});
      } else {
        nextCheckAt = Math.min(nextCheckAt, dueAt);
      }
    }
    if (nextCheckAt < Infinity) {
      graceTimerRef.current = setTimeout(() => reviewPresence(code, myUid), nextCheckAt - now + 50);
    }
  }, []);

  // Marks this client present in the room via Realtime Database, which (unlike
  // Firestore) can detect disconnects — clean tab close, crash, or network loss —
  // server-side via onDisconnect(), even when our own JS never gets to run again.
  const trackPresence = useCallback((code, myUid) => {
    const myPresenceRef = rtdbRef(rtdb, `presence/${code}/${myUid}`);

    // Register presence on every (re)connect, not just once: the server
    // discards an onDisconnect handler after it fires, so after a network blip
    // we'd otherwise stay absent from presence and get purged from the room.
    if (connectedUnsubscribeRef.current) connectedUnsubscribeRef.current();
    connectedUnsubscribeRef.current = onValue(rtdbRef(rtdb, '.info/connected'), snap => {
      if (snap.val() !== true) return;
      onDisconnect(myPresenceRef).remove().catch(() => {});
      rtdbSet(myPresenceRef, true).catch(() => {});
    });

    if (presenceUnsubscribeRef.current) presenceUnsubscribeRef.current();
    staleSinceRef.current = {};
    presenceSnapshotRef.current = {};
    const roomPresenceRef = rtdbRef(rtdb, `presence/${code}`);
    presenceUnsubscribeRef.current = onValue(roomPresenceRef, snap => {
      presenceSnapshotRef.current = snap.val() || {};
      reviewPresence(code, myUid);
    });
  }, [reviewPresence]);

  // Subscribes to newly-thrown weapon events for the room. Uses startAt(now)
  // so a client that just joined never replays the backlog of past throws —
  // only events written from this moment on arrive. The additional ts check
  // in the callback guards against clock-skew edge cases around the boundary.
  const subscribeThrows = useCallback((code) => {
    if (throwsUnsubscribeRef.current) { throwsUnsubscribeRef.current(); throwsUnsubscribeRef.current = null; }
    setThrows([]);
    subscribeStartAtRef.current = Date.now();
    const throwsQuery = query(
      rtdbRef(rtdb, `throws/${code}`),
      orderByChild('ts'),
      startAt(subscribeStartAtRef.current),
    );
    throwsUnsubscribeRef.current = onChildAdded(throwsQuery, snap => {
      const val = snap.val();
      if (!val || val.ts < subscribeStartAtRef.current) return;
      setThrows(prev => [...prev, { id: snap.key, ...val }]);
    });
  }, []);

  const subscribeTo = useCallback((code) => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    setRoomCode(code);
    unsubscribeRef.current = onSnapshot(doc(db, 'rooms', code), snap => {
      const myUid = uidRef.current;
      if (!snap.exists()) {
        teardown();
        clearMyPresence(code, myUid);
        setRoom(null);
        setRoomCode(null);
        setNotice('This room was closed.');
        return;
      }
      const data = snap.data();
      if (myUid && !(myUid in data.participants)) {
        // Another client's disconnect cleanup removed us (e.g. after a network
        // blip). Exit cleanly instead of lingering half-in the room.
        teardown();
        clearMyPresence(code, myUid);
        setRoom(null);
        setRoomCode(null);
        setNotice('You lost connection and were removed from the room — join again below.');
        return;
      }
      setRoom(data);
    }, err => setError(err.message));
  }, [teardown]);

  const createRoom = useCallback(async ({ name, avatar, isObserver }) => {
    if (!uid) throw new Error('Not signed in yet');
    setNotice(null);
    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
      const code = randomRoomCode();
      const ref = doc(db, 'rooms', code);
      const existing = await getDoc(ref);
      if (existing.exists()) continue;
      const data = {
        code,
        story: '',
        isRevealed: false,
        creatorId: uid,
        createdAt: serverTimestamp(),
        participants: {
          [uid]: { name, avatar, isObserver, vote: null, joinedAt: Date.now() },
        },
      };
      await setDoc(ref, data);
      subscribeTo(code);
      trackPresence(code, uid);
      subscribeThrows(code);
      return code;
    }
    throw new Error('Could not allocate a room code, please try again');
  }, [uid, subscribeTo, trackPresence, subscribeThrows]);

  const joinRoom = useCallback(async (code, { name, avatar, isObserver }) => {
    if (!uid) throw new Error('Not signed in yet');
    setNotice(null);
    const ref = doc(db, 'rooms', code);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error('Room not found');
    }
    await updateDoc(ref, {
      [`participants.${uid}`]: { name, avatar, isObserver, vote: null, joinedAt: Date.now() },
    });
    subscribeTo(code);
    trackPresence(code, uid);
    subscribeThrows(code);
  }, [uid, subscribeTo, trackPresence, subscribeThrows]);

  const setRole = useCallback(async (isObserver) => {
    if (!uid || !roomCode) return;
    if (!roomRef.current?.participants?.[uid]) throw new Error('Not in this room');
    await updateDoc(doc(db, 'rooms', roomCode), {
      [`participants.${uid}.isObserver`]: isObserver,
      [`participants.${uid}.vote`]: null,
    });
  }, [uid, roomCode]);

  const castVote = useCallback(async (value) => {
    if (!uid || !roomCode) return;
    // A partial write here would recreate us as a corrupt participant if
    // disconnect cleanup removed us a moment ago.
    if (!roomRef.current?.participants?.[uid]) throw new Error('Not in this room');
    await updateDoc(doc(db, 'rooms', roomCode), {
      [`participants.${uid}.vote`]: value,
    });
  }, [uid, roomCode]);

  const setStory = useCallback(async (story) => {
    if (!roomCode) return;
    await updateDoc(doc(db, 'rooms', roomCode), { story });
  }, [roomCode]);

  const reveal = useCallback(async () => {
    if (!roomCode) return;
    await updateDoc(doc(db, 'rooms', roomCode), { isRevealed: true });
  }, [roomCode]);

  const startNextRound = useCallback(async () => {
    if (!roomCode || !room) return;
    const clearedVotes = {};
    for (const pid of Object.keys(room.participants)) {
      clearedVotes[`participants.${pid}.vote`] = null;
    }
    await updateDoc(doc(db, 'rooms', roomCode), {
      isRevealed: false,
      story: '',
      ...clearedVotes,
    });
  }, [roomCode, room]);

  // Observers can be hit but can't throw — enforced here, not just in the UI.
  const throwWeapon = useCallback(async (targetUid, weaponId) => {
    if (!uid || !roomCode) return;
    const me = roomRef.current?.participants?.[uid];
    if (!me || me.isObserver) return;
    const throwsListRef = rtdbRef(rtdb, `throws/${roomCode}`);
    const newThrowRef = push(throwsListRef);
    onDisconnect(newThrowRef).remove().catch(() => {});
    await rtdbSet(newThrowRef, { fromUid: uid, toUid: targetUid, weaponId, ts: Date.now() });
    setTimeout(() => {
      onDisconnect(newThrowRef).cancel().catch(() => {});
      rtdbRemove(newThrowRef).catch(() => {});
    }, THROW_CLEANUP_MS);
  }, [uid, roomCode]);

  // Removes a throw from local render state once its animation has finished.
  // Purely local UI cleanup — separate from the RTDB node's own deletion above.
  const dismissThrow = useCallback((throwId) => {
    setThrows(prev => prev.filter(t => t.id !== throwId));
  }, []);

  const leave = useCallback(async () => {
    if (!uid || !roomCode) return;
    const code = roomCode;
    // Stop listening before touching the backend so mid-leave snapshot and
    // presence events can't race the removal or flash stale UI.
    teardown();
    setRoom(null);
    setRoomCode(null);
    setNotice(null);
    clearMyPresence(code, uid);
    try {
      const ref = doc(db, 'rooms', code);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const remaining = Object.keys(snap.data().participants).filter(id => id !== uid);
      if (remaining.length === 0) {
        await deleteDoc(ref);
      } else {
        await updateDoc(ref, { [`participants.${uid}`]: deleteField() });
        // If several people left at once, everyone saw someone else remaining
        // and nobody took the delete branch — re-check so the last write out
        // still cleans up the empty room.
        const after = await getDoc(ref);
        if (after.exists() && Object.keys(after.data().participants).length === 0) {
          await deleteDoc(ref);
        }
      }
    } catch {
      // Best-effort: if this fails (e.g. offline), other clients' disconnect
      // cleanup removes us once our presence entry drops.
    }
  }, [uid, roomCode, teardown]);

  return {
    uid, room, roomCode, error, notice, throws,
    createRoom, joinRoom, setRole, castVote, setStory, reveal, startNextRound, leave,
    throwWeapon, dismissThrow,
  };
}
