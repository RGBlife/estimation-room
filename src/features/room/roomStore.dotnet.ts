import { create } from 'zustand';
import type { PlanningTicket, ReadinessChange } from '../../types/planning.ts';
import { normalizeTeamName } from '../../shared/lib/teamName.ts';
import { RoomConnection } from '../../shared/lib/roomConnection.ts';
import { saveLastRoomCode, saveProfile } from '../join/profile.ts';
import { normalizeAvatar } from '../avatar/avatar.ts';
import type { AvatarOptions, RoomDoc, JoinPayload, CardValue, DeckId, RoomPeek } from '../../types/room.ts';
import type { ThrowEvent } from '../../types/throws.ts';
import type { DriverState, TableCrackEvent, TablePieceMove, WastedMap } from '../../types/gta.ts';
import { recordDriverSample, forgetDriver, forgetAllDrivers } from './remoteDriverSamples.ts';

interface RoomState {
  uid: string | null;
  room: RoomDoc | null;
  roomCode: string | null;
  error: string | null;
  notice: string | null;
  throws: ThrowEvent[];
  drivers: Record<string, DriverState>;
  tableCracks: TableCrackEvent[];
  tablePieceMove: { left: TablePieceMove; right: TablePieceMove };
  tableWasted: WastedMap;

  initAuth: () => () => void;
  createRoom: (payload: JoinPayload) => Promise<string>;
  joinRoom: (code: string, payload: JoinPayload) => Promise<void>;
  peekRoom: (code: string) => Promise<RoomPeek | null>;
  updateAvatar: (avatar: AvatarOptions) => Promise<void>;
  setRole: (isObserver: boolean) => Promise<void>;
  castVote: (value: CardValue) => Promise<void>;
  changeReadiness: (change: ReadinessChange) => Promise<void>;
  selectTicket: (ticket: PlanningTicket | null) => Promise<void>;
  renameRoom: (teamName: string) => Promise<void>;
  setDeck: (deckId: DeckId) => Promise<void>;
  reveal: () => Promise<void>;
  startNextRound: () => Promise<void>;
  leave: () => Promise<void>;
  throwWeapon: (targetUid: string, weaponId: string, offsetX?: number, offsetY?: number) => Promise<void>;
  dismissThrow: (throwId: string) => void;
  startDrive: () => void;
  publishDrive: (state: Omit<DriverState, 'uid'>) => void;
  stopDrive: () => void;
  publishCrack: (crack: Omit<TableCrackEvent, 'id' | 'fromUid' | 'ts'>) => void;
  publishPieceMove: (side: 'left' | 'right', move: TablePieceMove) => void;
  markPlayerWasted: (targetUid: string) => void;
  resetTable: () => void;
}


const zeroPieces = () => ({ left: { x: 0, y: 0, rot: 0 }, right: { x: 0, y: 0, rot: 0 } });
const emptyLiveState = () => ({ throws: [], drivers: {}, tableCracks: [], tablePieceMove: zeroPieces(), tableWasted: {} });
let driving = false;
let lastDrive: Omit<DriverState, 'uid'> | null = null;
let lastDriveAt = 0;

// Position updates arrive per driver, and seven drivers each sending ~20 a
// second meant ~140 store updates -- each a table render -- per second.
// They are folded into one update per DRIVER_BATCH_MS, matching the Firebase
// adapter; phase changes, hits and removals still land immediately so
// explosions and squashes stay in step. Every sample reaches the
// interpolation buffer as it arrives regardless.
const DRIVER_BATCH_MS = 50;
let pendingDrivers: Record<string, DriverState> | null = null;
let driverFlushTimer: ReturnType<typeof setTimeout> | null = null;

function clearDriverBatch(): void {
  if (driverFlushTimer) clearTimeout(driverFlushTimer);
  driverFlushTimer = null;
  pendingDrivers = null;
  forgetAllDrivers();
}

export const useRoomStore = create<RoomState>((set, get) => {
  const connection = new RoomConnection(message => {
    switch (message.type) {
      case 'room': set({ room: message.room, roomCode: message.room.code, error: null }); break;
      case 'throw': set(s => ({ throws: [...s.throws.slice(-63), message.item] })); break;
      case 'drivers':
        clearDriverBatch();
        for (const [uid, driver] of Object.entries(message.drivers as Record<string, DriverState>)) recordDriverSample(uid, driver);
        set({ drivers: message.drivers }); break;
      case 'driver': {
        const base = pendingDrivers ?? get().drivers;
        const previous = base[message.uid];
        const next = { ...base };
        if (message.driver) { next[message.uid] = message.driver; recordDriverSample(message.uid, message.driver); }
        else { delete next[message.uid]; forgetDriver(message.uid); }
        pendingDrivers = next;
        const flush = () => {
          if (driverFlushTimer) clearTimeout(driverFlushTimer);
          driverFlushTimer = null;
          if (pendingDrivers) set({ drivers: pendingDrivers });
          pendingDrivers = null;
        };
        const urgent = !message.driver || !previous
          || previous.phase !== message.driver.phase || previous.hit !== message.driver.hit;
        if (urgent) flush();
        else if (!driverFlushTimer) driverFlushTimer = setTimeout(flush, DRIVER_BATCH_MS);
        break;
      }
      case 'crack': set(s => ({ tableCracks: [...s.tableCracks.slice(-127), message.item] })); break;
      case 'table': set({ tableCracks: message.tableCracks, tablePieceMove: message.tablePieceMove, tableWasted: message.tableWasted }); break;
      case 'closed':
        connection.forgetRoom(); driving = false; clearDriverBatch();
        set({ room: null, roomCode: null, notice: message.reason, ...emptyLiveState() }); break;
    }
  }, error => set({ error }), uid => set({ uid }));
  const command = (action: string, data = {}) => connection.command(action, data);
  const transient = (action: string, data = {}) => { void command(action, data).catch(error => set({ error: error.message })); };
  const join = async (action: 'create' | 'join', payload: JoinPayload, code?: string) => {
    clearDriverBatch();
    set({ notice: null, error: null, ...emptyLiveState() });
    const normalized = { ...payload, avatar: normalizeAvatar(payload.avatar) };
    const result = await command(action, { ...normalized, ...(code ? { code: code.toUpperCase() } : {}) });
    const joinedCode = result.code!;
    connection.rememberRoom(joinedCode, normalized);
    saveLastRoomCode(joinedCode);
    set({ roomCode: joinedCode });
    return joinedCode;
  };
  return {
    uid: null, room: null, roomCode: null, error: null, notice: null, ...emptyLiveState(),
    initAuth: () => connection.start(),
    createRoom: payload => join('create', payload),
    joinRoom: async (code, payload) => { await join('join', payload, code); },
    peekRoom: async code => (await command('peek', { code: code.toUpperCase() })).room ?? null,
    updateAvatar: async avatar => {
      const me = get().room?.participants[get().uid ?? ''];
      if (!me) throw new Error('Join the room before editing your avatar');
      const normalized = normalizeAvatar(avatar);
      await command('avatar', { avatar: normalized });
      saveProfile({ name: me.name, avatar: normalized, isObserver: me.isObserver });
      connection.updateProfile({ avatar: normalized });
    },
    setRole: async isObserver => { await command('role', { isObserver }); connection.updateProfile({ isObserver }); },
    castVote: async value => { await command('vote', { value }); },
    changeReadiness: async change => { await command('readiness', change); },
    selectTicket: async ticket => { await command('ticket', { ticket }); },
    renameRoom: async teamName => { await command('rename', { teamName: normalizeTeamName(teamName) ?? null }); },
    setDeck: async deck => { await command('deck', { deck }); },
    reveal: async () => { await command('reveal'); },
    startNextRound: async () => { await command('next'); },
    throwWeapon: async (targetUid, weaponId, offsetX = 0, offsetY = 0) => { await command('throw', { targetUid, weaponId, offsetX, offsetY }); },
    dismissThrow: id => set(s => ({ throws: s.throws.filter(t => t.id !== id) })),
    startDrive: () => { driving = true; lastDrive = null; lastDriveAt = 0; transient('startDrive'); },
    publishDrive: state => {
      if (!driving || !connection.connected) return;
      const now = performance.now();
      const changed = state.phase !== lastDrive?.phase || state.hit !== lastDrive?.hit;
      if (!changed && now - lastDriveAt < 50) return;
      if (!changed && lastDrive && state.x === lastDrive.x && state.y === lastDrive.y && state.r === lastDrive.r && now - lastDriveAt < 1000) return;
      lastDrive = state; lastDriveAt = now;
      transient('drive', state);
    },
    stopDrive: () => { driving = false; if (get().roomCode) transient('stopDrive'); },
    publishCrack: crack => transient('crack', crack),
    publishPieceMove: (side, move) => transient('piece', { side, move }),
    markPlayerWasted: targetUid => transient('wasted', { targetUid }),
    resetTable: () => transient('reset'),
    leave: async () => {
      connection.forgetRoom(); driving = false; clearDriverBatch();
      try { if (connection.connected && get().roomCode) await command('leave'); }
      finally { set({ room: null, roomCode: null, notice: null, error: null, ...emptyLiveState() }); }
    },
  };
});
