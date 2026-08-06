// Shape of a single weapon-throw event under the Realtime Database `throws`
// path. Keep weaponId in sync with the WEAPONS list in lib/weapons.js, which
// itself must stay in sync with the regex in database.rules.json.

export interface ThrowEvent {
  id: string; // RTDB push key, attached client-side (snap.key)
  fromUid: string;
  toUid: string;
  weaponId: string;
  ts: number;
  offsetX: number;
  offsetY: number;
}
