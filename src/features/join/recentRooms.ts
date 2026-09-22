import type { AvatarOptions, LegacyAvatarOptions, RoomDoc } from '../../types/room.ts';

// Rooms this device has sat in, newest first. Device-local on purpose: there
// are no accounts, and a list that lives only in this browser keeps the
// no-signup, delete-it-yourself promise intact. Whether a room is still open
// is a live question answered separately (useRoomStatuses); this file only
// remembers.
const RECENT_ROOMS_KEY = 'sp_recent_rooms_v1';
export const MAX_RECENT_ROOMS = 6;
const MAX_REMEMBERED_PEOPLE = 8;
const CODE_PATTERN = /^[A-Z0-9]{1,6}$/;
// A stream of votes re-sends the room document without the table changing;
// unchanged snapshots are written at most this often.
const REWRITE_INTERVAL_MS = 60000;

export interface RememberedPerson {
  name: string;
  avatar?: AvatarOptions | LegacyAvatarOptions;
  avatarUrl?: string;
}

export interface RecentRoom {
  teamName?: string;
  code: string;
  // When this device was last in the room, ms since epoch.
  lastSeenAt: number;
  createdByMe: boolean;
  // Everyone else at the table the last time we were there. Shown on the
  // card until a live check replaces it, and as the memory of a closed room.
  people: RememberedPerson[];
}

function isPerson(value: unknown): value is RememberedPerson {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.name === 'string'
    && (p.avatar === undefined || (typeof p.avatar === 'object' && p.avatar !== null))
    && (p.avatarUrl === undefined || typeof p.avatarUrl === 'string');
}

function readAll(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const rooms: RecentRoom[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const { code, lastSeenAt, createdByMe, people, teamName } = entry as Record<string, unknown>;
      if (typeof code !== 'string' || !CODE_PATTERN.test(code)) continue;
      if (typeof lastSeenAt !== 'number' || !Number.isFinite(lastSeenAt)) continue;
      rooms.push({
        code,
        ...(typeof teamName === 'string' && teamName.trim() && teamName.trim().length <= 40 ? { teamName: teamName.trim() } : {}),
        lastSeenAt,
        createdByMe: createdByMe === true,
        people: Array.isArray(people) ? people.filter(isPerson).slice(0, MAX_REMEMBERED_PEOPLE) : [],
      });
    }
    return rooms.sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, MAX_RECENT_ROOMS);
  } catch {
    return [];
  }
}

function writeAll(rooms: RecentRoom[]): void {
  try {
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(rooms));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) -- the list just won't persist.
  }
}

export function loadRecentRooms(): RecentRoom[] {
  return readAll();
}

let lastSignature: string | null = null;
let lastWriteAt = 0;

// Called with every room snapshot while in a room, from whichever backend is
// live, so the entry always reflects the table as it was when we left.
export function rememberRoom(room: RoomDoc, uid: string, now = Date.now()): void {
  const people: RememberedPerson[] = Object.entries(room.participants)
    .filter(([id]) => id !== uid)
    .slice(0, MAX_REMEMBERED_PEOPLE)
    .map(([, p]) => ({ name: p.name, ...(p.avatar ? { avatar: p.avatar } : {}), ...(p.avatarUrl ? { avatarUrl: p.avatarUrl } : {}) }));
  const createdByMe = room.creatorId === uid;
  const signature = JSON.stringify([room.code, room.teamName, createdByMe, people]);
  if (signature === lastSignature && now - lastWriteAt < REWRITE_INTERVAL_MS) return;
  lastSignature = signature;
  lastWriteAt = now;
  const others = readAll().filter(r => r.code !== room.code);
  writeAll([{ code: room.code, ...(room.teamName ? { teamName: room.teamName } : {}), lastSeenAt: now, createdByMe, people }, ...others].slice(0, MAX_RECENT_ROOMS));
}

export function forgetRoom(code: string): RecentRoom[] {
  // Forgetting must not be undone by the write throttle if the same table is
  // rejoined straight away.
  lastSignature = null;
  const rooms = readAll().filter(r => r.code !== code);
  writeAll(rooms);
  return rooms;
}

// Coarse and compact on purpose: the visible strip of a fanned card has
// room for one short word or two, and "when" only needs to tell this
// morning's room from last sprint's.
export function describeLastSeen(lastSeenAt: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - lastSeenAt) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 2) return 'Yesterday';
  if (days < 14) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}
