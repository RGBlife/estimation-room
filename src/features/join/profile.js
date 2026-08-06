const PROFILE_KEY = 'sp_profile';

export function loadProfile() {
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

export function saveProfile({ name, avatar }) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, avatar }));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — profile just won't persist.
  }
}

const LAST_ROOM_KEY = 'sp_last_room';

export function loadLastRoomCode() {
  try {
    return localStorage.getItem(LAST_ROOM_KEY) || null;
  } catch {
    return null;
  }
}

export function saveLastRoomCode(code) {
  try {
    localStorage.setItem(LAST_ROOM_KEY, code);
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — code just won't persist.
  }
}
