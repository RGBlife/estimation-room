import { create } from 'zustand';
import {
  doc, onSnapshot, type Unsubscribe as FirestoreUnsubscribe,
} from 'firebase/firestore';
import {
  ref as rtdbRef, query, orderByChild, startAt, onChildAdded, type Unsubscribe as RtdbUnsubscribe,
} from 'firebase/database';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, rtdb, auth } from '../../shared/lib/firebase.ts';
import { saveLastRoomCode } from '../join/profile.ts';
import { clearMyPresence, trackPresence, teardownPresence } from './roomStore.presence.ts';
import {
  createRoomAction, joinRoomAction, setRoleAction, castVoteAction, setStoryAction,
  revealAction, startNextRoundAction, throwWeaponAction, leaveAction,
} from './roomStore.actions.ts';
import type { RoomDoc, JoinPayload, CardValue } from '../../types/room.ts';
import type { ThrowEvent } from '../../types/throws.ts';

interface RoomState {
  uid: string | null;
  room: RoomDoc | null;
  roomCode: string | null;
  error: string | null;
  notice: string | null;
  throws: ThrowEvent[];

  initAuth: () => () => void;
  createRoom: (payload: JoinPayload) => Promise<string>;
  joinRoom: (code: string, payload: JoinPayload) => Promise<void>;
  setRole: (isObserver: boolean) => Promise<void>;
  castVote: (value: CardValue) => Promise<void>;
  setStory: (story: string) => Promise<void>;
  reveal: () => Promise<void>;
  startNextRound: () => Promise<void>;
  leave: () => Promise<void>;
  throwWeapon: (targetUid: string, weaponId: string, offsetX?: number, offsetY?: number) => Promise<void>;
  dismissThrow: (throwId: string) => void;
}

// Listener handles for the room doc / throws subscriptions. Like
// roomStore.presence.ts, these are module-level because they're scoped to
// "a room is currently joined," not to any component's mount lifecycle --
// join/leave actions start and stop them, not React effects.
let snapshotUnsubscribe: FirestoreUnsubscribe | null = null;
let throwsUnsubscribe: RtdbUnsubscribe | null = null;
let throwsSubscribeStartAt = 0;

function teardown(set: (partial: Partial<RoomState>) => void): void {
  if (snapshotUnsubscribe) { snapshotUnsubscribe(); snapshotUnsubscribe = null; }
  if (throwsUnsubscribe) { throwsUnsubscribe(); throwsUnsubscribe = null; }
  teardownPresence();
  set({ throws: [] });
}

// Subscribes to newly-thrown weapon events for the room. Uses startAt(now)
// so a client that just joined never replays the backlog of past throws —
// only events written from this moment on arrive. The additional ts check
// in the callback guards against clock-skew edge cases around the boundary.
function subscribeThrows(code: string, set: (fn: (state: RoomState) => Partial<RoomState>) => void): void {
  if (throwsUnsubscribe) { throwsUnsubscribe(); throwsUnsubscribe = null; }
  set(() => ({ throws: [] }));
  throwsSubscribeStartAt = Date.now();
  const throwsQuery = query(
    rtdbRef(rtdb, `throws/${code}`),
    orderByChild('ts'),
    startAt(throwsSubscribeStartAt),
  );
  throwsUnsubscribe = onChildAdded(throwsQuery, snap => {
    const val = snap.val();
    if (!val || val.ts < throwsSubscribeStartAt) return;
    set(state => ({ throws: [...state.throws, { id: snap.key!, ...val }] }));
  });
}

function subscribeTo(
  code: string,
  get: () => RoomState,
  set: (partial: Partial<RoomState> | ((state: RoomState) => Partial<RoomState>)) => void,
): void {
  if (snapshotUnsubscribe) snapshotUnsubscribe();
  set({ roomCode: code });
  saveLastRoomCode(code);
  snapshotUnsubscribe = onSnapshot(doc(db, 'rooms', code), snap => {
    const myUid = get().uid;
    if (!snap.exists()) {
      teardown(set);
      if (myUid) clearMyPresence(code, myUid);
      set({ room: null, roomCode: null, notice: 'This room was closed.' });
      return;
    }
    const data = snap.data() as RoomDoc;
    if (myUid && !(myUid in data.participants)) {
      // Another client's disconnect cleanup removed us (e.g. after a network
      // blip). Exit cleanly instead of lingering half-in the room.
      teardown(set);
      clearMyPresence(code, myUid);
      set({
        room: null,
        roomCode: null,
        notice: 'You lost connection and were removed from the room — join again below.',
      });
      return;
    }
    set({ room: data });
  }, err => set({ error: err.message }));
}

export const useRoomStore = create<RoomState>((set, get) => ({
  uid: null,
  room: null,
  roomCode: null,
  error: null,
  notice: null,
  throws: [],

  initAuth: () => {
    return onAuthStateChanged(auth, user => {
      if (user) {
        set({ uid: user.uid });
      } else {
        signInAnonymously(auth).catch(err => set({ error: err.message }));
      }
    });
  },

  createRoom: async (payload) => {
    const { uid } = get();
    if (!uid) throw new Error('Not signed in yet');
    set({ notice: null });
    const code = await createRoomAction(uid, payload);
    subscribeTo(code, get, set);
    trackPresence(code, uid, () => get().room);
    subscribeThrows(code, set);
    return code;
  },

  joinRoom: async (code, payload) => {
    const { uid } = get();
    if (!uid) throw new Error('Not signed in yet');
    set({ notice: null });
    await joinRoomAction(uid, code, payload);
    subscribeTo(code, get, set);
    trackPresence(code, uid, () => get().room);
    subscribeThrows(code, set);
  },

  setRole: async (isObserver) => {
    const { uid, roomCode, room } = get();
    if (!uid || !roomCode) return;
    await setRoleAction(uid, roomCode, room, isObserver);
  },

  castVote: async (value) => {
    const { uid, roomCode, room } = get();
    if (!uid || !roomCode) return;
    await castVoteAction(uid, roomCode, room, value);
  },

  setStory: async (story) => {
    const { roomCode } = get();
    if (!roomCode) return;
    await setStoryAction(roomCode, story);
  },

  reveal: async () => {
    const { roomCode } = get();
    if (!roomCode) return;
    await revealAction(roomCode);
  },

  startNextRound: async () => {
    const { roomCode, room } = get();
    if (!roomCode || !room) return;
    await startNextRoundAction(roomCode, room);
  },

  throwWeapon: async (targetUid, weaponId, offsetX = 0, offsetY = 0) => {
    const { uid, roomCode, room } = get();
    if (!uid || !roomCode) return;
    await throwWeaponAction(uid, roomCode, room, targetUid, weaponId, offsetX, offsetY);
  },

  dismissThrow: (throwId) => {
    set(state => ({ throws: state.throws.filter(t => t.id !== throwId) }));
  },

  leave: async () => {
    const { uid, roomCode } = get();
    if (!uid || !roomCode) return;
    const code = roomCode;
    // Stop listening before touching the backend so mid-leave snapshot and
    // presence events can't race the removal or flash stale UI.
    teardown(set);
    set({ room: null, roomCode: null, notice: null });
    clearMyPresence(code, uid);
    await leaveAction(uid, code);
  },
}));
