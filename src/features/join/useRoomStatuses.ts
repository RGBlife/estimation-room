import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomPeek } from '../../types/room.ts';
import type { RememberedPerson } from './recentRooms.ts';

export type PeekRoom = (code: string) => Promise<RoomPeek | null>;

export type RoomStatus =
  | { kind: 'checking' }
  | { kind: 'open'; teamName?: string; people: RememberedPerson[] }
  | { kind: 'closed' }
  | { kind: 'unknown' };

// Asks the backend, once per room per visit to the join screen, whether each
// remembered room is still open and who is at the table. Nothing is asked
// until the connection is ready; until then, and if a check fails, the card
// shows what this device remembers instead of a guess.
export function useRoomStatuses(codes: string[], peekRoom: PeekRoom | undefined, ready: boolean) {
  const [statuses, setStatuses] = useState<Record<string, RoomStatus>>({});
  const checked = useRef(new Set<string>());

  const check = useCallback((code: string) => {
    if (!peekRoom) return;
    checked.current.add(code);
    setStatuses(s => ({ ...s, [code]: { kind: 'checking' } }));
    peekRoom(code).then(
      peek => setStatuses(s => ({ ...s, [code]: peek ? { kind: 'open', ...(peek.teamName ? { teamName: peek.teamName } : {}), people: peek.participants } : { kind: 'closed' } })),
      () => setStatuses(s => ({ ...s, [code]: { kind: 'unknown' } })),
    );
  }, [peekRoom]);

  // Keyed on the joined codes rather than the array so a re-render with the
  // same rooms does not re-run the effect.
  const key = codes.join(',');
  useEffect(() => {
    if (!ready || !key) return;
    for (const code of key.split(',')) if (!checked.current.has(code)) check(code);
  }, [ready, key, check]);

  // A failed rejoin is new information about the room: ask again.
  const refresh = useCallback((code: string) => { check(code); }, [check]);

  return { statuses, refresh };
}
