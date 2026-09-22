import { beforeEach, describe, expect, it } from 'vitest';
import { describeLastSeen, forgetRoom, loadRecentRooms, MAX_RECENT_ROOMS, rememberRoom } from './recentRooms.ts';
import { randomAvatar } from '../avatar/avatar.ts';
import type { RoomDoc } from '../../types/room.ts';

const KEY = 'sp_recent_rooms_v1';

// One fixed look for everyone: the write throttle compares snapshots, so a
// fresh random avatar per call would make every snapshot look like a change.
const AVATAR = randomAvatar();

function roomDoc(code: string, creatorId: string, names: Record<string, string>): RoomDoc {
  const participants: RoomDoc['participants'] = {};
  for (const [uid, name] of Object.entries(names)) participants[uid] = { name, isObserver: false, vote: null, joinedAt: 1, avatar: AVATAR };
  return { code, isRevealed: false, creatorId, deck: 'fibonacci', createdAt: 0, participants };
}

describe('recent rooms', () => {
  beforeEach(() => {
    localStorage.clear();
    // Each test starts with the write throttle forgotten.
    forgetRoom('');
  });

  it('remembers the room with everyone but me, and whether I created it', () => {
    rememberRoom(roomDoc('ABCD', 'me', { me: 'Me', u2: 'Sam', u3: 'Alex' }), 'me', 1000);
    const [room] = loadRecentRooms();
    expect(room.code).toBe('ABCD');
    expect(room.createdByMe).toBe(true);
    expect(room.lastSeenAt).toBe(1000);
    expect(room.people.map(p => p.name)).toEqual(['Sam', 'Alex']);
    expect(room.people[0].avatar).toBeTruthy();
  });

  it('keeps the newest first and drops the oldest past the cap', () => {
    for (let i = 0; i < MAX_RECENT_ROOMS + 2; i++) rememberRoom(roomDoc(`R${i}`, 'x', { me: 'Me' }), 'me', 1000 + i);
    const codes = loadRecentRooms().map(r => r.code);
    expect(codes).toHaveLength(MAX_RECENT_ROOMS);
    expect(codes[0]).toBe(`R${MAX_RECENT_ROOMS + 1}`);
    expect(codes).not.toContain('R0');
    expect(codes).not.toContain('R1');
  });

  it('moves a revisited room back to the front instead of duplicating it', () => {
    rememberRoom(roomDoc('AAAA', 'x', { me: 'Me' }), 'me', 1000);
    rememberRoom(roomDoc('BBBB', 'x', { me: 'Me' }), 'me', 2000);
    rememberRoom(roomDoc('AAAA', 'x', { me: 'Me' }), 'me', 3000);
    expect(loadRecentRooms().map(r => r.code)).toEqual(['AAAA', 'BBBB']);
  });

  it('writes an unchanged table at most once a minute, but a changed one immediately', () => {
    rememberRoom(roomDoc('ABCD', 'x', { me: 'Me', u2: 'Sam' }), 'me', 1000);
    rememberRoom(roomDoc('ABCD', 'x', { me: 'Me', u2: 'Sam' }), 'me', 5000);
    expect(loadRecentRooms()[0].lastSeenAt).toBe(1000);
    rememberRoom(roomDoc('ABCD', 'x', { me: 'Me', u2: 'Sam', u3: 'Alex' }), 'me', 6000);
    expect(loadRecentRooms()[0].lastSeenAt).toBe(6000);
    rememberRoom(roomDoc('ABCD', 'x', { me: 'Me', u2: 'Sam', u3: 'Alex' }), 'me', 70000);
    expect(loadRecentRooms()[0].lastSeenAt).toBe(70000);
  });

  it('forgets a room, and remembers it again if rejoined straight away', () => {
    rememberRoom(roomDoc('ABCD', 'x', { me: 'Me' }), 'me', 1000);
    rememberRoom(roomDoc('EFGH', 'x', { me: 'Me' }), 'me', 2000);
    expect(forgetRoom('ABCD').map(r => r.code)).toEqual(['EFGH']);
    expect(loadRecentRooms().map(r => r.code)).toEqual(['EFGH']);
    forgetRoom('EFGH');
    rememberRoom(roomDoc('EFGH', 'x', { me: 'Me' }), 'me', 2500);
    expect(loadRecentRooms().map(r => r.code)).toEqual(['EFGH']);
  });

  it('ignores corrupt storage and malformed entries', () => {
    localStorage.setItem(KEY, 'not json');
    expect(loadRecentRooms()).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify([
      { code: 'lower', lastSeenAt: 1 },
      { code: 'GOOD', lastSeenAt: 1, people: [{ name: 'Sam' }, { nope: true }, 'x'] },
      { code: 'NOTS', lastSeenAt: 'yesterday' },
      null,
    ]));
    const rooms = loadRecentRooms();
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toEqual({ code: 'GOOD', lastSeenAt: 1, createdByMe: false, people: [{ name: 'Sam' }] });
  });

  it('describes when a room was last visited in a few words', () => {
    const now = Date.UTC(2026, 8, 18, 12, 0, 0);
    const minute = 60000;
    expect(describeLastSeen(now - 20000, now)).toBe('Just now');
    expect(describeLastSeen(now - 5 * minute, now)).toBe('5m ago');
    expect(describeLastSeen(now - 3 * 60 * minute, now)).toBe('3h ago');
    expect(describeLastSeen(now - 26 * 60 * minute, now)).toBe('Yesterday');
    expect(describeLastSeen(now - 4 * 24 * 60 * minute, now)).toBe('4d ago');
    expect(describeLastSeen(now - 21 * 24 * 60 * minute, now)).toBe('3w ago');
  });
});

it('round-trips names and persists renames and clearing within the throttle window', () => {
  localStorage.clear(); forgetRoom('');
  const room = roomDoc('TEAM', 'me', { me: 'Me' });
  rememberRoom(room, 'me', 1000);
  expect(loadRecentRooms()[0]).not.toHaveProperty('teamName');
  rememberRoom({ ...room, teamName: 'Platform' }, 'me', 1001);
  expect(loadRecentRooms()[0].teamName).toBe('Platform');
  rememberRoom({ ...room, teamName: 'Design' }, 'me', 1002);
  expect(loadRecentRooms()[0].teamName).toBe('Design');
  rememberRoom(room, 'me', 1003);
  expect(loadRecentRooms()[0]).not.toHaveProperty('teamName');
});
