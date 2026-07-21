import { useCallback, useEffect, useRef, useState } from 'react';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, deleteField,
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase.js';
import { randomRoomCode } from './roomCode.js';

const MAX_CREATE_ATTEMPTS = 3;

export function useRoom() {
  const [uid, setUid] = useState(null);
  const [room, setRoom] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);

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

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  const subscribeTo = useCallback((code) => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    setRoomCode(code);
    unsubscribeRef.current = onSnapshot(doc(db, 'rooms', code), snap => {
      if (!snap.exists()) {
        setRoom(null);
        return;
      }
      setRoom(snap.data());
    }, err => setError(err.message));
  }, []);

  const createRoom = useCallback(async ({ name, avatarUrl, isObserver }) => {
    if (!uid) throw new Error('Not signed in yet');
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
          [uid]: { name, avatarUrl, isObserver, vote: null, joinedAt: Date.now() },
        },
      };
      await setDoc(ref, data);
      subscribeTo(code);
      return code;
    }
    throw new Error('Could not allocate a room code, please try again');
  }, [uid, subscribeTo]);

  const joinRoom = useCallback(async (code, { name, avatarUrl, isObserver }) => {
    if (!uid) throw new Error('Not signed in yet');
    const ref = doc(db, 'rooms', code);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error('Room not found');
    }
    await updateDoc(ref, {
      [`participants.${uid}`]: { name, avatarUrl, isObserver, vote: null, joinedAt: Date.now() },
    });
    subscribeTo(code);
  }, [uid, subscribeTo]);

  const setRole = useCallback(async (isObserver) => {
    if (!uid || !roomCode) return;
    await updateDoc(doc(db, 'rooms', roomCode), {
      [`participants.${uid}.isObserver`]: isObserver,
      [`participants.${uid}.vote`]: null,
    });
  }, [uid, roomCode]);

  const castVote = useCallback(async (value) => {
    if (!uid || !roomCode) return;
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

  const leave = useCallback(async () => {
    if (!uid || !roomCode) return;
    const ref = doc(db, 'rooms', roomCode);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const remaining = Object.keys(data.participants).filter(id => id !== uid);
      if (remaining.length === 0) {
        await deleteDoc(ref);
      } else {
        await updateDoc(ref, { [`participants.${uid}`]: deleteField() });
      }
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setRoom(null);
    setRoomCode(null);
  }, [uid, roomCode]);

  return {
    uid, room, roomCode, error,
    createRoom, joinRoom, setRole, castVote, setStory, reveal, startNextRound, leave,
  };
}
