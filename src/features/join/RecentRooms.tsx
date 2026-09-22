import type { CSSProperties } from 'react';
import { participantAvatarSrc } from '../avatar/index.js';
import { describeLastSeen, type RecentRoom, type RememberedPerson } from './recentRooms.ts';
import type { RoomStatus } from './useRoomStatuses.ts';

// The hero's hand of cards, dealt from rooms this device has sat in. A real
// playing card carries its index in the corner so a fanned hand can still be
// read; here the index is the room code, which is the whole reason the card
// exists. The face shows who is (or was) at the table and whether the room
// is still open.
const MAX_FACES = 3;
const TILT_PER_CARD_DEG = 4;
const ARC_PER_CARD_PX = 4;

interface RecentRoomsProps {
  rooms: RecentRoom[];
  statuses: Record<string, RoomStatus>;
  // The room being rejoined right now, so its card can say so.
  joiningCode: string | null;
  // True while not connected or while any join is in flight.
  disabled: boolean;
  onRejoin: (code: string) => void;
  onForget: (code: string) => void;
  now?: number;
}

function statusLine(room: RecentRoom, status: RoomStatus, joining: boolean, now: number): string {
  if (joining) return 'Joining…';
  switch (status.kind) {
    case 'open': return status.people.length === 0 ? 'Empty' : `${status.people.length} here`;
    case 'closed': return 'Closed';
    default: return describeLastSeen(room.lastSeenAt, now);
  }
}

function withFace(people: RememberedPerson[]): RememberedPerson[] {
  return people.filter(p => p.avatar || p.avatarUrl);
}

export default function RecentRooms({ rooms, statuses, joiningCode, disabled, onRejoin, onForget, now = Date.now() }: RecentRoomsProps) {
  const centre = (rooms.length - 1) / 2;
  return (
    <section className="sp-room-hand-block" aria-labelledby="recent-rooms-heading">
      <h2 id="recent-rooms-heading" className="sp-room-hand-heading">Your recent rooms</h2>
      <ul className="sp-room-hand" style={{ '--n': rooms.length } as CSSProperties}>
        {rooms.map((room, i) => {
          const status = statuses[room.code] ?? { kind: 'unknown' };
          const closed = status.kind === 'closed';
          const joining = joiningCode === room.code;
          const line = statusLine(room, status, joining, now);
          const lastSeen = describeLastSeen(room.lastSeenAt, now);
          const people = withFace(status.kind === 'open' ? status.people : room.people);
          // A successful peek with no name means the creator cleared it.
          const teamName = status.kind === 'open' ? status.teamName : room.teamName;
          const named = teamName ? ` ${teamName}.` : '';
          const label = closed
            ? `Room ${room.code} is closed.${named} Last here ${lastSeen.toLowerCase()}`
            : `Rejoin room ${room.code}. ${line}.${named} Last here ${lastSeen.toLowerCase()}`;
          const style = {
            '--i': i,
            '--tilt': `${(i - centre) * TILT_PER_CARD_DEG}deg`,
            '--lift': `${Math.abs(i - centre) * ARC_PER_CARD_PX}px`,
          } as CSSProperties;
          return (
            <li key={room.code} style={style}>
              <button
                type="button"
                className="sp-room-card"
                data-face={room.createdByMe ? 'host' : 'guest'}
                data-state={status.kind}
                aria-label={label}
                aria-disabled={closed || disabled}
                onClick={() => { if (!closed && !disabled) onRejoin(room.code); }}
              >
                <span className="sp-room-card-index" aria-hidden="true">{room.code}</span>
                {teamName && <span className="sp-room-card-team" title={teamName}>{teamName}</span>}
                <span className="sp-room-card-faces" aria-hidden="true">
                  {people.length === 0 && <i className="sp-room-card-seat" />}
                  {people.slice(0, MAX_FACES).map((p, j) => (
                    <img key={j} className="sp-room-card-face" src={participantAvatarSrc(p)} alt="" width="30" height="30" />
                  ))}
                  {people.length > MAX_FACES && <span className="sp-room-card-more">+{people.length - MAX_FACES}</span>}
                </span>
                <span className="sp-room-card-status">{line}</span>
                <span className="sp-room-card-index sp-room-card-index-mirror" aria-hidden="true">{room.code}</span>
              </button>
              <button type="button" className="sp-room-card-forget" aria-label={`Forget room ${room.code}`} onClick={() => onForget(room.code)}>
                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
