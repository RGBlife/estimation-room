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
