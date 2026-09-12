// Transient weapon event delivered by the room connection.
export interface ThrowEvent {
  id: string; // Server-issued event ID
  fromUid: string;
  toUid: string;
  weaponId: string;
  ts: number;
  offsetX: number;
  offsetY: number;
}
