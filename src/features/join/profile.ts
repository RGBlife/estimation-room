import type { AvatarOptions } from '../../types/room.ts';

const PROFILE_KEY = 'sp_profile';

export interface Profile {
  name: string;
  avatar: AvatarOptions;
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.avatar) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfile({ name, avatar }: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, avatar }));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — profile just won't persist.
  }
}

const LAST_ROOM_KEY = 'sp_last_room';

export function loadLastRoomCode(): string | null {
  try {
    return localStorage.getItem(LAST_ROOM_KEY) || null;
  } catch {
    return null;
  }
}

export function saveLastRoomCode(code: string): void {
  try {
    localStorage.setItem(LAST_ROOM_KEY, code);
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — code just won't persist.
  }
}
